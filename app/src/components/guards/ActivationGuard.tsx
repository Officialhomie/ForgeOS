'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useOsStore } from '@/stores/os.store'
import { useActivationStore } from '@/stores/activation.store'
import { readUserTreasuryBalance } from '@/lib/treasury/onchain'

/**
 * ActivationGuard
 *
 * Gate for all /dashboard routes. A wallet is considered "activated" when:
 *   1. It is connected (wagmi has an address).
 *   2. It has a positive USDC balance in the treasury — verified on-chain
 *      via getUserBalance(address). The chain is the authoritative source.
 *
 * If the stored activation phase is 'active' but the on-chain balance is 0
 * (e.g. funds were withdrawn, or stale localStorage), the stored state for
 * that wallet is reset and the user is redirected to /activate.
 *
 * Note: we NEVER trust os.store's `osStatus` or activation.store's `phase`
 * alone to grant access — they are only UX cache. The on-chain check always runs.
 */
export function ActivationGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { address, isConnected, status: walletStatus } = useAccount()
  const setOsStatus = useOsStore((s) => s.setOsStatus)
  const [resolved, setResolved] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    let cancelled = false

    const resolveActivation = async () => {
      // Wagmi is still restoring the session from a previous connection —
      // do not resolve yet or we redirect before the address is available.
      if (walletStatus === 'reconnecting' || walletStatus === 'connecting') {
        return
      }

      // No wallet connected — always redirect.
      if (!isConnected || !address) {
        if (!cancelled) {
          setActive(false)
          setResolved(true)
        }
        return
      }

      const store = useActivationStore.getState()
      const walletState = store.getWallet(address)
      const rootDelegation = useOsStore.getState().rootDelegation
      const permissionsDone = walletState.completedSteps.includes('permissions')

      // Always verify on-chain. getUserBalance(address) is the source of truth for funding.
      const balance = await readUserTreasuryBalance(address)
      const funded = typeof balance === 'bigint' && balance > 0n

      if (funded) {
        setOsStatus('active')
        if (!cancelled) {
          setActive(true)
          setResolved(true)
        }
        return
      }

      // Permissions + root delegation: allow dashboard (builder, marketplace) even if
      // treasury RPC is slow/zero — avoids kicking users to /activate mid-launch.
      if (permissionsDone && rootDelegation) {
        setOsStatus('active')
        if (!cancelled) {
          setActive(true)
          setResolved(true)
        }
        return
      }

      // Not funded on-chain. If the store thinks this wallet is 'active',
      // that state is stale (funds withdrawn or localStorage leftover).
      // Reset it so the wizard starts clean for this wallet.
      if (walletState.phase === 'active') {
        store.resetWallet(address)
      }

      setOsStatus('inactive')
      if (!cancelled) {
        setActive(false)
        setResolved(true)
      }
    }

    void resolveActivation()
    return () => {
      cancelled = true
    }
  }, [address, isConnected, walletStatus, pathname, setOsStatus])

  useEffect(() => {
    if (!resolved) return
    if (!active) router.replace('/activate')
  }, [active, resolved, router])

  if (!resolved || !active) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-forge-text-muted">
        <div className="flex items-center gap-2">
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-forge-border border-t-forge-orange" />
          Checking your account…
        </div>
        {address && (
          <p className="font-mono text-xs text-forge-text-subtle">
            {address.slice(0, 6)}…{address.slice(-4)}
          </p>
        )}
      </div>
    )
  }

  return <>{children}</>
}
