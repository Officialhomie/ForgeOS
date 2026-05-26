'use client'

import { useWalletRuntimeDiagnostics } from '@/hooks/useWalletRuntimeDiagnostics'

/** Warn when multiple extensions fight over window.ethereum (breaks ERC-7715). */
export function WalletProviderNotice() {
  const { diag, ready } = useWalletRuntimeDiagnostics()

  if (!ready) return null

  if (diag.hasFlaskCandidate && diag.hasStandardMetaMaskCandidate) {
    return (
      <div className="rounded-lg border border-forge-danger/50 bg-forge-danger/10 px-3 py-2.5 text-xs text-forge-danger">
        <p className="font-semibold">Two MetaMask extensions detected</p>
        <p className="mt-1 text-forge-danger/90">
          Regular MetaMask and MetaMask Flask are both installed. The page may be
          talking to the wrong one (console: &quot;Cannot set property ethereum&quot;).
          Disable <strong>regular MetaMask</strong> for this browser profile, keep only
          Flask, then hard-refresh and reconnect on Step 1.
        </p>
      </div>
    )
  }

  if (diag.kind === 'metamask') {
    return (
      <div className="rounded-lg border border-forge-danger/50 bg-forge-danger/10 px-3 py-2.5 text-xs text-forge-danger">
        <p className="font-semibold">Connected to standard MetaMask</p>
        <p className="mt-1 text-forge-danger/90">
          ERC-7715 needs MetaMask Flask. Disable standard MetaMask, use Flask only,
          refresh, and reconnect.
        </p>
      </div>
    )
  }

  if (diag.kind === 'flask') {
    return (
      <p className="rounded-lg border border-forge-success/30 bg-forge-success/5 px-3 py-2 text-xs text-forge-success">
        MetaMask Flask detected for this page. Stay on Ethereum Sepolia before signing.
      </p>
    )
  }

  return null
}
