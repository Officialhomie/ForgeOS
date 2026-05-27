import {
  DelegationGranted,
  DelegationRevoked,
  AllDelegationsRevoked,
} from '../../generated/OSKernel/OSKernel'
import {
  ActivityEvent,
  Delegation,
  KernelState,
  KnownDelegatee,
} from '../../generated/schema'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function loadOrCreateKernelState(): KernelState {
  let state = KernelState.load('kernel')
  if (state === null) {
    state = new KernelState('kernel')
    state.activeDelegationHashes = new Array<string>()
  }
  return state as KernelState
}

function appendActiveHash(state: KernelState, hashHex: string): void {
  const hashes = state.activeDelegationHashes
  hashes.push(hashHex)
  state.activeDelegationHashes = hashes
}

function removeActiveHash(state: KernelState, hashHex: string): void {
  const hashes = state.activeDelegationHashes
  const idx = hashes.indexOf(hashHex)
  if (idx !== -1) {
    hashes.splice(idx, 1)
    state.activeDelegationHashes = hashes
  }
}

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

export function handleDelegationGranted(event: DelegationGranted): void {
  const hashHex = event.params.delegationHash.toHexString()
  const delegatorHex = event.params.delegator.toHexString()
  const delegateHex = event.params.delegate.toHexString()

  // Infer hop count: if the delegator is already a known delegatee, this is a sub-delegation.
  let hopCount = 0
  const parentEntry = KnownDelegatee.load(delegatorHex)
  if (parentEntry !== null) {
    hopCount = parentEntry.hopCount + 1
  }

  // Persist delegation
  const delegation = new Delegation(hashHex)
  delegation.hash = event.params.delegationHash
  delegation.delegator = event.params.delegator
  delegation.delegatee = event.params.delegate
  delegation.hopCount = hopCount
  delegation.status = 'ACTIVE'
  delegation.createdAt = event.block.timestamp
  delegation.save()

  // Index the delegate so future delegations from them get the right hop
  let known = KnownDelegatee.load(delegateHex)
  if (known === null) {
    known = new KnownDelegatee(delegateHex)
  }
  known.hopCount = hopCount
  known.save()

  // Track hash in kernel state for mass-revoke
  const state = loadOrCreateKernelState()
  appendActiveHash(state, hashHex)
  state.save()

  // Activity feed
  const activityId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const activity = new ActivityEvent(activityId)
  activity.eventType = 'DELEGATION_GRANTED'
  activity.actor = event.params.delegator
  activity.agentId = null
  activity.delegationHash = event.params.delegationHash
  activity.description = 'Delegation granted to ' + delegateHex
  activity.amount = null
  activity.txHash = event.transaction.hash
  activity.timestamp = event.block.timestamp
  activity.save()
}

export function handleDelegationRevoked(event: DelegationRevoked): void {
  const hashHex = event.params.delegationHash.toHexString()

  const delegation = Delegation.load(hashHex)
  if (delegation !== null) {
    delegation.status = 'REVOKED'
    delegation.save()
  }

  const state = loadOrCreateKernelState()
  removeActiveHash(state, hashHex)
  state.save()

  const activityId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const activity = new ActivityEvent(activityId)
  activity.eventType = 'DELEGATION_REVOKED'
  activity.actor = event.transaction.from
  activity.agentId = null
  activity.delegationHash = event.params.delegationHash
  activity.description = 'Delegation revoked'
  activity.amount = null
  activity.txHash = event.transaction.hash
  activity.timestamp = event.block.timestamp
  activity.save()
}

export function handleAllDelegationsRevoked(event: AllDelegationsRevoked): void {
  // Revoke every tracked active delegation
  const state = loadOrCreateKernelState()
  const hashes = state.activeDelegationHashes

  for (let i = 0; i < hashes.length; i++) {
    const hashHex = hashes[i]
    const delegation = Delegation.load(hashHex)
    if (delegation !== null) {
      delegation.status = 'REVOKED'
      delegation.save()
    }
  }

  state.activeDelegationHashes = new Array<string>()
  state.save()

  const activityId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const activity = new ActivityEvent(activityId)
  activity.eventType = 'ALL_DELEGATIONS_REVOKED'
  activity.actor = event.params.owner
  activity.agentId = null
  activity.delegationHash = null
  activity.description = 'Kill switch: all ' + event.params.count.toString() + ' delegations revoked'
  activity.amount = null
  activity.txHash = event.transaction.hash
  activity.timestamp = event.block.timestamp
  activity.save()
}
