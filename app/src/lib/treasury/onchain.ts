'use client'

import { createPublicClient, http, parseAbi } from 'viem'
import type { Address } from 'viem'
import { forgeChain } from '@/lib/wagmi/chains'
import { CONTRACTS } from '@/lib/contracts'
import { isValidAddress } from '@/lib/utils'

const treasuryAbi = parseAbi([
  'function getBalance() view returns (uint256)',
  'function getUserBalance(address user) view returns (uint256)',
])

const erc20BalanceAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
])

function createForgeClient() {
  return createPublicClient({
    chain: forgeChain,
    transport: http(forgeChain.rpcUrls.default.http[0]),
  })
}

/** Returns the global total USDC held by the treasury contract (all users combined). */
export async function readTreasuryBalance(): Promise<bigint | null> {
  const address = CONTRACTS.agentTreasury
  if (!isValidAddress(address)) return null

  try {
    const client = createForgeClient()
    return await client.readContract({
      address,
      abi: treasuryAbi,
      functionName: 'getBalance',
    })
  } catch {
    return null
  }
}

/**
 * Returns the USDC balance for a specific wallet address in the treasury.
 * This is the authoritative per-wallet check — used by ActivationGuard to
 * determine whether a connected wallet has funded their account.
 */
export async function readUserTreasuryBalance(user: Address): Promise<bigint | null> {
  const contractAddress = CONTRACTS.agentTreasury
  if (!isValidAddress(contractAddress) || !isValidAddress(user)) return null

  try {
    const client = createForgeClient()
    return await client.readContract({
      address: contractAddress,
      abi: treasuryAbi,
      functionName: 'getUserBalance',
      args: [user],
    })
  } catch {
    return null
  }
}

/** Sepolia USDC sitting in the user's wallet (before deposit into the spending pool). */
export async function readWalletUsdcBalance(user: Address): Promise<bigint | null> {
  const token = CONTRACTS.usdc
  if (!isValidAddress(token) || !isValidAddress(user)) return null

  try {
    const client = createForgeClient()
    return await client.readContract({
      address: token,
      abi: erc20BalanceAbi,
      functionName: 'balanceOf',
      args: [user],
    })
  } catch {
    return null
  }
}
