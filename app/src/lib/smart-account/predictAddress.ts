'use client'

import {
  Implementation,
  toMetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit'
import { createPublicClient, createWalletClient, custom, type Address } from 'viem'
import { forgeChain } from '@/lib/wagmi/chains'

export async function predictSmartAccountAddress(
  ownerAddress: Address,
): Promise<Address> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Wallet provider not available')
  }

  const publicClient = createPublicClient({
    chain: forgeChain,
    transport: custom(window.ethereum),
  })

  const walletClient = createWalletClient({
    account: ownerAddress,
    chain: forgeChain,
    transport: custom(window.ethereum),
  })

  const smartAccount = await toMetaMaskSmartAccount({
    // viem public client chain typing — cast to never to satisfy toMetaMaskSmartAccount overloads
    client: publicClient as never,
    implementation: Implementation.Stateless7702,
    address: ownerAddress,
    signer: { walletClient },
  })

  return smartAccount.address
}
