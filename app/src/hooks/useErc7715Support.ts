'use client'

import { useEffect, useState } from 'react'
import {
  getErc7715Provider,
  probeErc7715RpcSupport,
  refreshWalletRuntimeCache,
} from '@/lib/wagmi/ethereum-provider'

export function useErc7715Support() {
  const [ready, setReady] = useState(false)
  const [rpcAvailable, setRpcAvailable] = useState(false)

  useEffect(() => {
    void (async () => {
      await refreshWalletRuntimeCache()
      const provider = await getErc7715Provider()
      const available = await probeErc7715RpcSupport(provider)
      setRpcAvailable(available)
      setReady(true)
    })()
  }, [])

  return { ready, rpcAvailable }
}
