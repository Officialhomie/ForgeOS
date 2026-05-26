'use client'

import { createPublicClient, http, parseAbi } from 'viem'
import { forgeChain } from '@/lib/wagmi/chains'
import { CONTRACTS } from '@/lib/contracts'
import { isValidAddress } from '@/lib/utils'

const treasuryAbi = parseAbi(['function getBalance() view returns (uint256)'])

export async function readTreasuryBalance(): Promise<bigint | null> {
  const address = CONTRACTS.agentTreasury
  if (!isValidAddress(address)) return null

  try {
    const client = createPublicClient({
      chain: forgeChain,
      transport: http(forgeChain.rpcUrls.default.http[0]),
    })
    return await client.readContract({
      address,
      abi: treasuryAbi,
      functionName: 'getBalance',
    })
  } catch {
    return null
  }
}
