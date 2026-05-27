import type { PublicClient } from 'viem'
import { parseAbi, parseUnits } from 'viem'
import type { Address } from '@/types'

const treasuryMetaAbi = parseAbi([
  'function usdc() view returns (address)',
])

const erc20MetaAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

export type TreasuryFundingPreflight = {
  treasuryUsdc: Address
  configuredUsdc: Address
  usdcMismatch: boolean
  usdcHasCode: boolean
  balance: bigint
  allowance: bigint
  fundSimulationOk: boolean
  simulationError: string | null
}

export async function preflightTreasuryFunding(
  publicClient: PublicClient,
  params: {
    treasuryAddress: Address
    configuredUsdc: Address
    funder: Address
    amount: bigint
  },
): Promise<TreasuryFundingPreflight> {
  const { treasuryAddress, configuredUsdc, funder, amount } = params

  const treasuryUsdc = (await publicClient.readContract({
    address: treasuryAddress,
    abi: treasuryMetaAbi,
    functionName: 'usdc',
  })) as Address

  const bytecode = await publicClient.getBytecode({ address: treasuryUsdc })
  const usdcHasCode = Boolean(bytecode && bytecode !== '0x')

  let balance = 0n
  let allowance = 0n
  if (usdcHasCode) {
    ;[balance, allowance] = await Promise.all([
      publicClient.readContract({
        address: treasuryUsdc,
        abi: erc20MetaAbi,
        functionName: 'balanceOf',
        args: [funder],
      }),
      publicClient.readContract({
        address: treasuryUsdc,
        abi: erc20MetaAbi,
        functionName: 'allowance',
        args: [funder, treasuryAddress],
      }),
    ])
  }

  let fundSimulationOk = false
  let simulationError: string | null = null
  if (usdcHasCode) {
    if (balance < amount) {
      simulationError = 'Insufficient USDC balance'
    } else if (allowance < amount) {
      // Approve runs before fund(); missing allowance is expected on first fund.
      fundSimulationOk = true
    } else {
      try {
        await publicClient.simulateContract({
          address: treasuryAddress,
          abi: parseAbi(['function fund(uint256 amount)']),
          functionName: 'fund',
          args: [amount],
          account: funder,
        })
        fundSimulationOk = true
      } catch (e) {
        simulationError = e instanceof Error ? e.message : String(e)
      }
    }
  } else {
    simulationError = `Treasury USDC ${treasuryUsdc} is not a contract on this chain`
  }

  return {
    treasuryUsdc,
    configuredUsdc,
    usdcMismatch: treasuryUsdc.toLowerCase() !== configuredUsdc.toLowerCase(),
    usdcHasCode,
    balance,
    allowance,
    fundSimulationOk,
    simulationError,
  }
}

export function formatTreasuryPreflightError(
  preflight: TreasuryFundingPreflight,
  fundAmountUsdc: string,
): string {
  if (!preflight.usdcHasCode) {
    return (
      `AgentTreasury expects USDC at ${preflight.treasuryUsdc}, but that address has no contract on Ethereum Sepolia. ` +
      'The treasury was deployed with the wrong USDC token (Base Sepolia address). ' +
      'Redeploy AgentTreasury with Circle Sepolia USDC 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238, then update NEXT_PUBLIC_AGENT_TREASURY_ADDRESS.'
    )
  }

  if (preflight.usdcMismatch) {
    return (
      `Treasury accepts USDC at ${preflight.treasuryUsdc}, but the app is configured for ${preflight.configuredUsdc}. ` +
      'Update NEXT_PUBLIC_USDC_ADDRESS to match treasury.usdc(), or redeploy the treasury.'
    )
  }

  if (preflight.balance < parseUnits(fundAmountUsdc, 6)) {
    return `Insufficient Sepolia USDC at ${preflight.treasuryUsdc}. Need ${fundAmountUsdc} USDC — fund the wallet with Circle Sepolia USDC.`
  }

  if (!preflight.fundSimulationOk) {
    const reason =
      preflight.simulationError?.includes('transfer amount exceeds allowance')
        ? `USDC allowance for the treasury is too low. Approve ${fundAmountUsdc} USDC for ${preflight.treasuryUsdc} and retry.`
        : (preflight.simulationError?.split('\n')[0] ??
          'Treasury fund() would revert on-chain')
    return `Treasury funding would fail: ${reason}`
  }

  return 'Treasury funding preflight failed'
}
