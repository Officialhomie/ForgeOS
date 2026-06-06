'use client'

import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { useOsStore } from '@/stores/os.store'
import { useDelegationsStore } from '@/stores/delegations.store'
import { createOSSubDelegations } from '@/lib/delegation/auto-delegate'
import { RELAY_SUBMITTED_MARKER } from '@/lib/delegation/proof-bundle'
import { useActivationStore } from '@/stores/activation.store'
import type { Delegation, Hash } from '@/types'

export interface SubDelegationsState {
  subDelegationHash: Hash | null
  reDelegationHash: Hash | null
  /** True when both delegations are set (local or relay-submitted). */
  ready: boolean
  /**
   * True when relay was unavailable and the delegation chain was NOT submitted on-chain.
   * The delegations exist locally but have not been registered in OSKernel.
   */
  relaySkipped: boolean
  error: string | null
  loading: boolean
}

interface RedelegateResponse {
  success: boolean
  taskId?: string
  code?: string
  relaySkipped?: boolean
  delegationHash?: string
  error?: string
}

/**
 * Returns the relay taskId when the relay accepted the transaction,
 * or null when the relay is unavailable on this chain (Sepolia).
 * Throws on unexpected errors.
 */
async function relayRedelegate(
  parentHash: Hash,
  delegation: Delegation,
): Promise<string | null> {
  const res = await fetch('/api/relay/redelegate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentHash, delegation }),
  })
  const data = (await res.json()) as RedelegateResponse
  if (!data.success) {
    if (data.code === 'RELAY_UNAVAILABLE') {
      // Chain has no relay payment tokens — delegation is local-only.
      return null
    }
    throw new Error(data.error ?? 'redelegate relay failed')
  }
  if (!data.taskId) {
    throw new Error('redelegate relay returned no taskId')
  }
  return data.taskId
}

/**
 * Marks a delegation as relay-submitted (pending on-chain inclusion).
 * Uses RELAY_SUBMITTED_MARKER — distinct from ONCHAIN_DELEGATION_MARKER which
 * is only set after webhook confirmation of on-chain inclusion.
 */
function markRelayAccepted(d: Delegation): Delegation {
  return {
    ...d,
    signature: RELAY_SUBMITTED_MARKER,
    status: 'active',
  }
}

/**
 * Marks a delegation as relay-skipped: the struct is valid locally but was
 * never submitted to the chain. Status stays 'active' for local use, but
 * the signature is NOT the relay-submitted or on-chain marker.
 */
function markRelaySkipped(d: Delegation): Delegation {
  return {
    ...d,
    status: 'active',
  }
}

export function useSubDelegations(): SubDelegationsState {
  const { address } = useAccount()
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
  const [relaySkipped, setRelaySkipped] = useState(false)

  useEffect(() => {
    if (!rootDelegation) return
    if (subDelegation && reDelegation) return
    if (creating.current) return

    const defiAgentAddress = process.env.NEXT_PUBLIC_DEFI_AGENT_ADDRESS
    const paymentAgentAddress = process.env.NEXT_PUBLIC_PAYMENT_AGENT_ADDRESS

    if (!defiAgentAddress || !paymentAgentAddress) {
      queueMicrotask(() =>
        setError('Set NEXT_PUBLIC_DEFI_AGENT_ADDRESS and NEXT_PUBLIC_PAYMENT_AGENT_ADDRESS'),
      )
      return
    }

    creating.current = true
    queueMicrotask(() => {
      setLoading(true)
      setError(null)
    })

    createOSSubDelegations(
      rootDelegation,
      defiAgentAddress as `0x${string}`,
      paymentAgentAddress as `0x${string}`,
    )
      .then(async ({ subDelegation: sub, reDelegation: re }) => {
        const subTaskId = await relayRedelegate(rootDelegation.hash, sub)
        const subConfirmed = subTaskId ? markRelayAccepted(sub) : markRelaySkipped(sub)
        setSubDelegation(subConfirmed)

        const reTaskId = await relayRedelegate(sub.hash, re)
        const reConfirmed = reTaskId ? markRelayAccepted(re) : markRelaySkipped(re)
        setReDelegation(reConfirmed)

        // Track whether relay was available for either delegation.
        if (!subTaskId || !reTaskId) {
          setRelaySkipped(true)
        }

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

        const smartAccount = address
          ? useActivationStore.getState().getWallet(address).smartAccountAddress
          : null
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
    relaySkipped,
    error,
    loading,
  }
}
