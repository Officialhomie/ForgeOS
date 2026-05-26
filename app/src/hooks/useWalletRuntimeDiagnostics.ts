'use client'

import { useEffect, useState } from 'react'
import {
  getEthereumProviderDiagnostics,
  refreshWalletRuntimeCache,
} from '@/lib/wagmi/ethereum-provider'

export function useWalletRuntimeDiagnostics() {
  const [diag, setDiag] = useState(() => getEthereumProviderDiagnostics())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void refreshWalletRuntimeCache().then(() => {
      const resolved = getEthereumProviderDiagnostics()
      setDiag(resolved)
      setReady(true)
    })
  }, [])

  const conflict =
    ready &&
    ((diag.hasFlaskCandidate && diag.hasStandardMetaMaskCandidate) ||
      diag.kind === 'metamask')

  return { diag, ready, conflict }
}
