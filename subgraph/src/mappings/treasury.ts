import { BigInt } from '@graphprotocol/graph-ts'
import {
  AgentBudgetSet,
  PaymentExecuted,
  RevenueDistributed,
  TreasuryFunded,
  TreasuryWithdrawn,
} from '../../generated/AgentTreasury/AgentTreasury'
import { ActivityEvent, TreasuryEvent, TreasuryState } from '../../generated/schema'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function loadOrCreateTreasuryState(timestamp: BigInt): TreasuryState {
  let state = TreasuryState.load('treasury')
  if (state === null) {
    state = new TreasuryState('treasury')
    state.balance = BigInt.fromI32(0)
    state.totalFunded = BigInt.fromI32(0)
    state.totalSpent = BigInt.fromI32(0)
    state.lastUpdatedAt = timestamp
  }
  return state as TreasuryState
}

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

export function handleTreasuryFunded(event: TreasuryFunded): void {
  const state = loadOrCreateTreasuryState(event.block.timestamp)
  state.balance = state.balance.plus(event.params.amount)
  state.totalFunded = state.totalFunded.plus(event.params.amount)
  state.lastUpdatedAt = event.block.timestamp
  state.save()

  const evId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const ev = new TreasuryEvent(evId)
  ev.eventType = 'FUNDED'
  ev.amount = event.params.amount
  ev.actor = event.params.funder
  ev.agentId = null
  ev.txHash = event.transaction.hash
  ev.timestamp = event.block.timestamp
  ev.userShare = null
  ev.refillShare = null
  ev.platformShare = null
  ev.save()

  const activityId = 'activity-' + evId
  const activity = new ActivityEvent(activityId)
  activity.eventType = 'TREASURY_FUNDED'
  activity.actor = event.params.funder
  activity.agentId = null
  activity.delegationHash = null
  activity.description = 'Treasury funded: ' + event.params.amount.toString() + ' USDC (6 decimals)'
  activity.amount = event.params.amount
  activity.txHash = event.transaction.hash
  activity.timestamp = event.block.timestamp
  activity.save()
}

export function handlePaymentExecuted(event: PaymentExecuted): void {
  const state = loadOrCreateTreasuryState(event.block.timestamp)
  state.balance = state.balance.minus(event.params.amount)
  state.totalSpent = state.totalSpent.plus(event.params.amount)
  state.lastUpdatedAt = event.block.timestamp
  state.save()

  const evId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const ev = new TreasuryEvent(evId)
  ev.eventType = 'PAYMENT'
  ev.amount = event.params.amount
  ev.actor = event.params.payee
  ev.agentId = event.params.agentId
  ev.txHash = event.transaction.hash
  ev.timestamp = event.block.timestamp
  ev.userShare = null
  ev.refillShare = null
  ev.platformShare = null
  ev.save()

  const activityId = 'activity-' + evId
  const activity = new ActivityEvent(activityId)
  activity.eventType = 'PAYMENT_EXECUTED'
  activity.actor = event.params.payee
  activity.agentId = event.params.agentId
  activity.delegationHash = null
  activity.description = 'Agent payment: ' + event.params.amount.toString() + ' USDC'
  activity.amount = event.params.amount
  activity.txHash = event.transaction.hash
  activity.timestamp = event.block.timestamp
  activity.save()
}

export function handleTreasuryWithdrawn(event: TreasuryWithdrawn): void {
  const state = loadOrCreateTreasuryState(event.block.timestamp)
  state.balance = state.balance.minus(event.params.amount)
  state.lastUpdatedAt = event.block.timestamp
  state.save()

  const evId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const ev = new TreasuryEvent(evId)
  ev.eventType = 'WITHDRAWN'
  ev.amount = event.params.amount
  ev.actor = event.params.user
  ev.agentId = null
  ev.txHash = event.transaction.hash
  ev.timestamp = event.block.timestamp
  ev.userShare = null
  ev.refillShare = null
  ev.platformShare = null
  ev.save()
}

export function handleRevenueDistributed(event: RevenueDistributed): void {
  // RevenueDistributed always follows PaymentExecuted in the same tx.
  // Store as its own TreasuryEvent of type DISTRIBUTION so the mapper can
  // extract the revenue split from the latest DISTRIBUTION event.
  const total = event.params.userShare
    .plus(event.params.refillShare)
    .plus(event.params.platformShare)

  const evId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const ev = new TreasuryEvent(evId)
  ev.eventType = 'DISTRIBUTION'
  ev.amount = total
  ev.actor = event.address
  ev.agentId = null
  ev.txHash = event.transaction.hash
  ev.timestamp = event.block.timestamp
  ev.userShare = event.params.userShare
  ev.refillShare = event.params.refillShare
  ev.platformShare = event.params.platformShare
  ev.save()
}

export function handleAgentBudgetSet(event: AgentBudgetSet): void {
  // No dedicated entity needed — just emit to activity feed
  const activityId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const activity = new ActivityEvent(activityId)
  activity.eventType = 'AGENT_BUDGET_SET'
  activity.actor = event.transaction.from
  activity.agentId = event.params.agentId
  activity.delegationHash = null
  activity.description = 'Agent budget set to ' + event.params.budget.toString()
  activity.amount = event.params.budget
  activity.txHash = event.transaction.hash
  activity.timestamp = event.block.timestamp
  activity.save()
}
