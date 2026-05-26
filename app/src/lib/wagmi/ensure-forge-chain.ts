import { forgeChain } from '@/lib/wagmi/chains'
import { getEthereumProvider } from '@/lib/wagmi/ethereum-provider'

type ForgeChainId = typeof forgeChain.id

type SwitchChainAsyncFn = (args: { chainId: ForgeChainId }) => Promise<unknown>

/** Add Ethereum Sepolia to MetaMask if missing, then switch. */
export async function ensureForgeChain(
  switchChainAsync: SwitchChainAsyncFn,
): Promise<void> {
  if (typeof window === 'undefined') return

  const provider = getEthereumProvider()
  if (!provider) {
    throw new Error(
      'MetaMask was not detected. Install the extension and reload this page in a supported browser.',
    )
  }

  const targetId = forgeChain.id

  try {
    await switchChainAsync({ chainId: targetId })
    return
  } catch (switchError) {
    if (!provider.request) throw switchError

    const rpc =
      forgeChain.rpcUrls.default.http[0] ?? 'https://rpc.ankr.com/eth_sepolia'

    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${targetId.toString(16)}`,
            chainName: forgeChain.name,
            nativeCurrency: forgeChain.nativeCurrency,
            rpcUrls: [rpc],
            blockExplorerUrls: forgeChain.blockExplorers?.default?.url
              ? [forgeChain.blockExplorers.default.url]
              : ['https://sepolia.etherscan.io'],
          },
        ],
      })
      await switchChainAsync({ chainId: targetId })
    } catch (addError) {
      const msg =
        addError instanceof Error ? addError.message : String(addError)
      throw new Error(
        `Could not switch to ${forgeChain.name} (chain ${targetId}). Add the network in MetaMask or approve the switch prompt. ${msg}`,
        { cause: addError },
      )
    }
  }
}
