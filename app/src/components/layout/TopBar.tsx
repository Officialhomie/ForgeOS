'use client'

import { useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useForgeWalletConnect } from '@/hooks/useForgeWalletConnect'
import { formatWalletError } from '@/lib/wagmi/ethereum-provider'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { Button } from '@/components/ui/Button'
import { NetworkIndicator } from '@/components/ui/NetworkIndicator'
import { KillSwitchModal } from '@/components/KillSwitchModal'
import { useCommandStore } from '@/stores/command.store'

export function TopBar() {
  const { address, isConnected } = useAccount()
  const { connectWallet, isPending, error: connectError } = useForgeWalletConnect()
  const { disconnect } = useDisconnect()
  const openCommand = useCommandStore((s) => s.setOpen)
  const [killSwitchOpen, setKillSwitchOpen] = useState(false)
  const [localConnectError, setLocalConnectError] = useState<string | null>(null)

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-forge-border bg-forge-surface px-6">
        <div className="flex items-center gap-4">
          <NetworkIndicator />
          <button
            onClick={() => openCommand(true)}
            className="hidden rounded border border-forge-border bg-forge-bg px-2 py-0.5 font-mono text-xs text-forge-text-subtle transition-colors hover:border-orange-500/50 hover:text-forge-text sm:inline"
          >
            ⌘K
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="destructive"
            className="shrink-0"
            onClick={() => setKillSwitchOpen(true)}
          >
            Kill Switch
          </Button>
          {isConnected && address ? (
            <>
              <AddressDisplay address={address} />
              <Button variant="ghost" onClick={() => disconnect()}>
                Disconnect
              </Button>
            </>
          ) : (
            <>
              {(localConnectError || connectError) && (
                <span className="max-w-xs truncate text-xs text-forge-danger">
                  {localConnectError ?? connectError?.message}
                </span>
              )}
              <Button
                variant="default"
                disabled={isPending}
                onClick={() => {
                  setLocalConnectError(null)
                  void connectWallet().catch((e) =>
                    setLocalConnectError(formatWalletError(e)),
                  )
                }}
              >
                {isPending ? 'Connecting…' : 'Connect Wallet'}
              </Button>
            </>
          )}
        </div>
      </header>

      {killSwitchOpen && (
        <KillSwitchModal onClose={() => setKillSwitchOpen(false)} />
      )}
    </>
  )
}
