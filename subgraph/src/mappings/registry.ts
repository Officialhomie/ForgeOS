import { BigInt } from '@graphprotocol/graph-ts'
import {
  AgentDeactivated,
  AgentRegistered,
} from '../../generated/ForgeOSRegistry/ForgeOSRegistry'
import { ActivityEvent, Agent } from '../../generated/schema'

export function handleAgentRegistered(event: AgentRegistered): void {
  const agentIdHex = event.params.agentId.toHexString()

  // Create agent entity — totalRuns / successfulRuns start at 0 and can be
  // incremented later by the cron route writing back via The Graph's admin API.
  const agent = new Agent(agentIdHex)
  agent.agentId = event.params.agentId
  agent.name = event.params.name
  agent.endpoint = ''
  agent.active = true
  agent.totalRuns = 0
  agent.successfulRuns = 0
  agent.totalSpent = BigInt.fromI32(0)
  agent.registeredAt = event.block.timestamp
  agent.save()

  const activityId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const activity = new ActivityEvent(activityId)
  activity.eventType = 'AGENT_REGISTERED'
  activity.actor = event.params.owner
  activity.agentId = event.params.agentId
  activity.delegationHash = null
  activity.description = 'Agent registered: ' + event.params.name
  activity.amount = null
  activity.txHash = event.transaction.hash
  activity.timestamp = event.block.timestamp
  activity.save()
}

export function handleAgentDeactivated(event: AgentDeactivated): void {
  const agentIdHex = event.params.agentId.toHexString()

  const agent = Agent.load(agentIdHex)
  if (agent !== null) {
    agent.active = false
    agent.save()
  }

  const activityId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const activity = new ActivityEvent(activityId)
  activity.eventType = 'AGENT_DEACTIVATED'
  activity.actor = event.transaction.from
  activity.agentId = event.params.agentId
  activity.delegationHash = null
  activity.description = 'Agent deactivated'
  activity.amount = null
  activity.txHash = event.transaction.hash
  activity.timestamp = event.block.timestamp
  activity.save()
}
