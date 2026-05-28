'use client'

import { useEffect, useRef, useState } from 'react'
import { useOsStore } from '@/stores/os.store'
import { useDelegationsStore } from '@/stores/delegations.store'
import { createOSSubDelegations } from '@/lib/delegation/auto-delegate'
import { ONCHAIN_DELEGATION_MARKER } from '@/lib/delegation/proof-bundle'
import { useActivationStore } from '@/stores/activation.store'
import type { Delegation, Hash } from '@/types'

export interface SubDelegationsState {
  subDelegationHash: Hash | null
  reDelegationHash: Hash | null
  ready: boolean
  error: string | null
  loading: boolean
}

async function relayRedelegate(
  parentHash: Hash,
  delegation: Delegation,
): Promise<string> {
  const res = await fetch('/api/relay/redelegate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentHash, delegation }),
  })
  const data = (await res.json()) as { success: boolean; taskId?: string; error?: string }
  if (!data.success || !data.taskId) {
    throw new Error(data.error ?? 'redelegate relay failed')
  }
  return data.taskId
}

function markOnChainConfirmed(d: Delegation): Delegation {
  return {
    ...d,
    signature: ONCHAIN_DELEGATION_MARKER,
    status: 'active',
  }
}

export function useSubDelegations(): SubDelegationsState {
  const rootDelegation = useOsStore((s) => s.rootDelegation)
  const subDelegation = useDelegationsStore((s) => s.subDelegation)
  const reDelegation = useDelegationsStore((s) => s.reDelegation)
  const setSubDelegation = useDelegationsStore((s) => s.setSubDelegation)
  const setReDelegation = useDelegationsStore((s) => s.setReDelegation)
  const setDelegations = useDelegationsStore((s) => s.setDelegations)
  const delegations = useDelegationsStore((s) => s.delegations)

  const creating = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!rootDelegation) return
    if (subDelegation && reDelegation) return
    if (creating.current) return

    const defiAgentAddress = process.env.NEXT_PUBLIC_DEFI_AGENT_ADDRESS
    const paymentAgentAddress = process.env.NEXT_PUBLIC_PAYMENT_AGENT_ADDRESS

    if (!defiAgentAddress || !paymentAgentAddress) {
      setError('Set NEXT_PUBLIC_DEFI_AGENT_ADDRESS and NEXT_PUBLIC_PAYMENT_AGENT_ADDRESS')
      return
    }

    creating.current = true
    setLoading(true)
    setError(null)

    createOSSubDelegations(
      rootDelegation,
      defiAgentAddress as `0x${string}`,
      paymentAgentAddress as `0x${string}`,
    )
      .then(async ({ subDelegation: sub, reDelegation: re }) => {
        await relayRedelegate(rootDelegation.hash, sub)
        const subConfirmed = markOnChainConfirmed(sub)
        setSubDelegation(subConfirmed)

        await relayRedelegate(sub.hash, re)
        const reConfirmed = markOnChainConfirmed(re)
        setReDelegation(reConfirmed)

        const all = [
          rootDelegation,
          ...delegations.filter(
            (d) =>
              d.hash !== sub.hash &&
              d.hash !== re.hash &&
              d.hash !== rootDelegation.hash,
          ),
          subConfirmed,
          reConfirmed,
        ]
        setDelegations(all)

        const smartAccount = useActivationStore.getState().smartAccountAddress
        if (smartAccount) {
          await fetch('/api/delegations/bundle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              smartAccountAddress: smartAccount,
              delegations: all,
            }),
          })
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Sub-delegation chain failed')
      })
      .finally(() => {
        creating.current = false
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootDelegation?.hash])

  return {
    subDelegationHash: subDelegation?.hash ?? null,
    reDelegationHash: reDelegation?.hash ?? null,
    ready: !!(subDelegation && reDelegation),
    error,
    loading,
  }
}
