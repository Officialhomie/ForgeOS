import type { EIP1193Provider } from 'viem'

export type InjectedWalletKind = 'flask' | 'metamask' | 'injected' | 'none'

type InjectedProvider = EIP1193Provider & {
  isMetaMask?: boolean
  /** Present on MetaMask Flask builds */
  isMetaMaskFlask?: boolean
  providers?: InjectedProvider[]
}

type EthereumWindow = Window & {
  ethereum?: InjectedProvider
}

const FLASK_RDNS = 'io.metamask.flask'

/** Set by async probe (web3_clientVersion + EIP-6963). */
let walletRuntimeCache: { isFlask: boolean; checkedAt: number } | null = null

let eip6963FlaskProvider: InjectedProvider | null = null

function resolveIsFlaskFromProbe(probe: {
  clientVersionLooksFlask: boolean
  eip6963Rdns: string[]
}): boolean {
  if (probe.clientVersionLooksFlask) return true
  return probe.eip6963Rdns.includes(FLASK_RDNS)
}

export function applyWalletRuntimeProbe(
  probe: Awaited<ReturnType<typeof probeWalletRuntime>>,
): void {
  walletRuntimeCache = {
    isFlask: resolveIsFlaskFromProbe(probe),
    checkedAt: Date.now(),
  }
}

/** Probe Flask via web3_clientVersion + EIP-6963 (isMetaMaskFlask is often false on modern Flask). */
export async function refreshWalletRuntimeCache(): Promise<void> {
  const probe = await probeWalletRuntime()
  applyWalletRuntimeProbe(probe)
}

function isRuntimeFlask(): boolean {
  return walletRuntimeCache?.isFlask === true
}

function collectProviders(): InjectedProvider[] {
  if (typeof window === 'undefined') return []
  const eth = (window as EthereumWindow).ethereum
  if (!eth) return []
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    return eth.providers
  }
  return [eth]
}

export function getInjectedWalletKind(
  provider: InjectedProvider | undefined,
): InjectedWalletKind {
  if (!provider) return 'none'
  if (provider.isMetaMaskFlask) return 'flask'
  if (provider.isMetaMask && isRuntimeFlask()) return 'flask'
  if (provider.isMetaMask) return 'metamask'
  return 'injected'
}

/**
 * Prefer MetaMask Flask when multiple extensions inject `window.ethereum.providers`.
 * ERC-7715 (`wallet_requestExecutionPermissions`) is Flask-only.
 */
export function getEthereumProvider(): InjectedProvider | undefined {
  const providers = collectProviders()
  if (providers.length === 0) return undefined

  const flask = providers.find((p) => p.isMetaMaskFlask)
  if (flask) return flask

  const metaMask = providers.find((p) => p.isMetaMask)
  return metaMask ?? providers[0]
}

/** Runtime probe — does not mutate wallet state. */
export async function probeWalletRuntime(): Promise<{
  providerFlags: Array<{
    index: number
    isMetaMask: boolean
    isMetaMaskFlask: boolean
    hasRequest: boolean
  }>
  clientVersion: string | null
  clientVersionLooksFlask: boolean
  eip6963Rdns: string[]
  syncDiag: ReturnType<typeof getEthereumProviderDiagnostics>
}> {
  const providers = collectProviders()
  const providerFlags = providers.map((p, index) => ({
    index,
    isMetaMask: !!p.isMetaMask,
    isMetaMaskFlask: !!p.isMetaMaskFlask,
    hasRequest: typeof p.request === 'function',
  }))

  const selected = getEthereumProvider()
  let clientVersion: string | null = null
  if (selected?.request) {
    try {
      const v = await selected.request({ method: 'web3_clientVersion' })
      clientVersion = typeof v === 'string' ? v : String(v)
    } catch {
      clientVersion = null
    }
  }

  const eip6963Rdns = await discoverEip6963Rdns()
  const clientVersionLooksFlask = (clientVersion ?? '')
    .toLowerCase()
    .includes('flask')

  const result = {
    providerFlags,
    clientVersion,
    clientVersionLooksFlask,
    eip6963Rdns,
    syncDiag: getEthereumProviderDiagnostics(),
  }
  applyWalletRuntimeProbe(result)
  result.syncDiag = getEthereumProviderDiagnostics()
  return result
}

type Eip6963Announcement = {
  info?: { rdns?: string; name?: string }
  provider?: InjectedProvider
}

function discoverEip6963Announcements(): Promise<Eip6963Announcement[]> {
  if (typeof window === 'undefined') return Promise.resolve([])
  const announcements: Eip6963Announcement[] = []
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963Announcement>).detail
    if (detail) announcements.push(detail)
  }
  window.addEventListener('eip6963:announceProvider', handler)
  window.dispatchEvent(new Event('eip6963:requestProvider'))
  return new Promise((resolve) => {
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', handler)
      const flask = announcements.find((a) => a.info?.rdns === FLASK_RDNS)
      if (flask?.provider) eip6963FlaskProvider = flask.provider
      resolve(announcements)
    }, 400)
  })
}

function discoverEip6963Rdns(): Promise<string[]> {
  return discoverEip6963Announcements().then((list) =>
    list.map((a) => a.info?.rdns).filter((r): r is string => !!r),
  )
}

/** Provider for ERC-7715 RPCs — prefers EIP-6963 Flask announcement. */
export async function getErc7715Provider(): Promise<InjectedProvider | undefined> {
  await discoverEip6963Announcements()
  if (eip6963FlaskProvider) return eip6963FlaskProvider
  return getEthereumProvider()
}

/** True if wallet exposes ERC-7715 RPC methods on the resolved provider. */
export async function probeErc7715RpcSupport(
  provider?: InjectedProvider,
): Promise<boolean> {
  const p = provider ?? (await getErc7715Provider())
  if (!p?.request) return false
  try {
    const request = p.request.bind(p) as (args: {
      method: string
      params?: unknown[]
    }) => Promise<unknown>
    await request({
      method: 'wallet_getSupportedExecutionPermissions',
      params: [],
    })
    return true
  } catch {
    return false
  }
}

export function getEthereumProviderDiagnostics(): {
  kind: InjectedWalletKind
  providerCount: number
  hasFlaskCandidate: boolean
  hasStandardMetaMaskCandidate: boolean
} {
  const providers = collectProviders()
  const hasFlaskFlag = providers.some((p) => p.isMetaMaskFlask)
  const hasFlaskCandidate = hasFlaskFlag || isRuntimeFlask()
  const hasStandardMetaMaskCandidate =
    providers.some((p) => p.isMetaMask && !p.isMetaMaskFlask) && !isRuntimeFlask()

  return {
    kind: getInjectedWalletKind(getEthereumProvider()),
    providerCount: providers.length,
    hasFlaskCandidate,
    hasStandardMetaMaskCandidate,
  }
}

export function hasEthereumProvider(): boolean {
  return !!getEthereumProvider()
}

/** Maps wagmi / wallet errors to actionable copy. */
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

/** ERC-7715 permission errors with Flask vs dual-extension hints. */
export function formatErc7715Error(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : String(error ?? 'Unknown error')

  const isMethodMissing =
    raw.includes('wallet_requestExecutionPermissions') ||
    raw.includes('does not exist') ||
    raw.includes('is not available') ||
    raw.includes('no handler') ||
    raw.includes("doesn't has corresponding handler") ||
    raw.includes('Method not found') ||
    raw.includes('not supported')

  if (!isMethodMissing) return raw

  const diag = getEthereumProviderDiagnostics()

  if (diag.hasFlaskCandidate && diag.hasStandardMetaMaskCandidate) {
    return (
      'ERC-7715 is not available on the wallet this page is using. You have both MetaMask and MetaMask Flask installed — disable regular MetaMask for localhost, keep only Flask, hard-refresh, and reconnect. (Console noise like ObjectMultiplex / StreamMiddleware is unrelated.)'
    )
  }

  if (diag.kind === 'metamask') {
    return (
      'This page is connected to standard MetaMask, not MetaMask Flask. ERC-7715 requires Flask — install it from metamask.io/flask, disable standard MetaMask for this site, refresh, and reconnect.'
    )
  }

  if (diag.kind === 'flask') {
    return (
      'MetaMask Flask is connected, but this build does not expose ERC-7715 (`wallet_requestExecutionPermissions`). ' +
      'Try a Flask build with ERC-7715 enabled. ' +
      `Raw error: ${raw}`
    )
  }

  return (
    'MetaMask Flask is required for ERC-7715. Install Flask from metamask.io/flask, switch to Ethereum Sepolia, reconnect, and retry.'
  )
}
