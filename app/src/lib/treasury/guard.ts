/**
 * Treasury balance guard before Venice inference.
 */

import { createPublicClient, http, formatUnits } from 'viem'
import { forgeChain } from '@/lib/wagmi/chains'
import { CONTRACTS } from '@/lib/contracts'

const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const MIN_USDC = Number(process.env.MIN_TREASURY_USDC ?? '1')

export async function assertTreasuryForInference(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const treasury = CONTRACTS.agentTreasury
  try {
    const client = createPublicClient({
      chain: forgeChain,
      transport: http(forgeChain.rpcUrls.default.http[0]),
    })
    const balance = await client.readContract({
      address: CONTRACTS.usdc,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [treasury],
    })
    const usdc = Number(formatUnits(balance, 6))
    if (usdc < MIN_USDC) {
      return {
        ok: false,
        message: `Treasury USDC balance ${usdc.toFixed(2)} below minimum ${MIN_USDC}. Top up treasury.`,
      }
    }
    return { ok: true }
  } catch {
    return { ok: true }
  }
}
