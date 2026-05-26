'use client'

import {
  Implementation,
  toMetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit'
import { createPublicClient, createWalletClient, custom, type Address } from 'viem'
import { sepolia } from '@/lib/wagmi/chains'

export async function predictSmartAccountAddress(
  ownerAddress: Address,
): Promise<Address> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Wallet provider not available')
  }

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: custom(window.ethereum),
  })

  const walletClient = createWalletClient({
    account: ownerAddress,
    chain: sepolia,
    transport: custom(window.ethereum),
  })

  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702,
    address: ownerAddress,
    signer: { walletClient },
  })

  return smartAccount.address
}
