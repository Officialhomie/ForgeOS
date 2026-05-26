import type { EIP1193Provider } from 'viem'

type EthereumWindow = Window & {
  ethereum?: EIP1193Provider & {
    providers?: EIP1193Provider[]
    isMetaMask?: boolean
  }
}

/** Resolves MetaMask (or first injected) EIP-1193 provider. */
export function getEthereumProvider(): EIP1193Provider | undefined {
  if (typeof window === 'undefined') return undefined

  const eth = (window as EthereumWindow).ethereum
  if (!eth) return undefined

  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    const metaMask = eth.providers.find(
      (p) => (p as { isMetaMask?: boolean }).isMetaMask,
    )
    return metaMask ?? eth.providers[0]
  }

  return eth
}

export function hasEthereumProvider(): boolean {
  return !!getEthereumProvider()
}

/** Maps wagmi `ProviderNotFoundError` to a clear install/open message. */
export function formatWalletError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Wallet connection failed'

  const name = 'name' in error ? String(error.name) : ''
  const message = 'message' in error ? String(error.message) : String(error)

  if (
    name === 'ProviderNotFoundError' ||
    message.includes('Provider not found')
  ) {
    return 'MetaMask was not detected. Install the extension, unlock your wallet, and open this site in Chrome or Firefox (not an embedded preview browser).'
  }

  if (message.includes('User rejected')) {
    return 'Connection request was rejected in MetaMask.'
  }

  return message
}
