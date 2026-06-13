import {
  createPublicClient,
  http,
  parseAbi,
  type Address,
  type Hash,
  type WalletClient,
} from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { forgeChain } from '@/lib/wagmi/chains'
import {
  formatTreasuryPreflightError,
  preflightTreasuryFunding,
} from '@/lib/treasury/validate-funding'

const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
])

const treasuryAbi = parseAbi(['function fund(uint256 amount)'])

function isTransportTimeout(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /transport request timed out|rpcerr53|timeout/i.test(message)
}

async function retryWriteContract(
  walletClient: WalletClient,
  request: Parameters<WalletClient['writeContract']>[0],
  label: 'approve' | 'fund',
): Promise<Hash> {
  try {
    return await walletClient.writeContract(request)
  } catch (err) {
    if (!isTransportTimeout(err)) throw err
    await new Promise((resolve) => setTimeout(resolve, 1500))
    try {
      return await walletClient.writeContract(request)
    } catch (retryErr) {
      if (!isTransportTimeout(retryErr)) throw retryErr
      throw new Error(
        `Sepolia RPC timed out during ${label}. Retry in a few seconds, or switch MetaMask Sepolia RPC to a faster endpoint (for example Infura/Alchemy) and try again.`,
      )
    }
  }
}

export function formatWalletFundingError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  if (/user denied transaction signature/i.test(message)) {
    return 'Funding needs 2 MetaMask confirmations (approve + fund). If you reject either step, no money is moved into your spending pool.'
  }
  return message
}

/**
 * Approve (if needed) and fund AgentTreasury from the connected wallet.
 * Shared by activation step 4 and the dashboard top-up modal.
 */
export async function fundTreasuryFromWallet(opts: {
  walletClient: WalletClient
  funder: Address
  amountRaw: bigint
  amountUsdcLabel: string
  signal?: AbortSignal
}): Promise<Hash> {
  const { walletClient, funder, amountRaw, amountUsdcLabel, signal } = opts

  if (amountRaw <= 0n) {
    throw new Error('Enter a USDC amount greater than 0')
  }

  const walletChain = walletClient.chain?.id ?? null
  if (walletChain !== forgeChain.id) {
    throw new Error(
      `Wallet network is ${walletChain ?? 'unknown'}. Switch MetaMask to Sepolia (${forgeChain.id}) and retry.`,
    )
  }

  const publicClient = createPublicClient({
    chain: forgeChain,
    transport: http(forgeChain.rpcUrls.default.http[0]),
  })

  const preflight = await preflightTreasuryFunding(publicClient, {
    treasuryAddress: CONTRACTS.agentTreasury,
    configuredUsdc: CONTRACTS.usdc,
    funder,
    amount: amountRaw,
  })

  if (!preflight.fundSimulationOk) {
    throw new Error(formatTreasuryPreflightError(preflight, amountUsdcLabel))
  }

  const fundingUsdc = preflight.treasuryUsdc

  if (preflight.allowance < amountRaw) {
    const approveHash = await retryWriteContract(
      walletClient,
      {
        address: fundingUsdc,
        abi: erc20Abi,
        functionName: 'approve',
        args: [CONTRACTS.agentTreasury, amountRaw],
        chain: forgeChain,
        account: funder,
      },
      'approve',
    )
    await publicClient.waitForTransactionReceipt({ hash: approveHash })
  }

  if (signal?.aborted) {
    throw new Error('Funding cancelled')
  }

  const fundHash = await retryWriteContract(
    walletClient,
    {
      address: CONTRACTS.agentTreasury,
      abi: treasuryAbi,
      functionName: 'fund',
      args: [amountRaw],
      chain: forgeChain,
      account: funder,
    },
    'fund',
  )

  const receipt = await publicClient.waitForTransactionReceipt({ hash: fundHash })
  if (receipt.status !== 'success') {
    throw new Error('Treasury funding transaction reverted on-chain')
  }

  return fundHash
}
