import { isDemoMode } from '@/lib/demo'
import {
  MOCK_AGENTS,
  MOCK_DELEGATIONS,
  MOCK_ACTIVITY,
  MOCK_TREASURY,
} from '@/lib/mock-data'
import { useDelegationsStore } from '@/stores/delegations.store'
import { useAgentsStore } from '@/stores/agents.store'
import { useActivityStore } from '@/stores/activity.store'
import { useTreasuryStore } from '@/stores/treasury.store'
import { useOsStore } from '@/stores/os.store'

export function hydrateDemoStores(): void {
  if (!isDemoMode()) return

  useOsStore.getState().setOsStatus('active')
  useOsStore.getState().setRootDelegation(MOCK_DELEGATIONS.root)
  useDelegationsStore.getState().setDelegations(Object.values(MOCK_DELEGATIONS))
  useDelegationsStore.getState().setSubDelegation(MOCK_DELEGATIONS['defi-rebalancer-sub'])
  useDelegationsStore.getState().setReDelegation(MOCK_DELEGATIONS['payment-executor-redel'])
  useAgentsStore.getState().setAgents(MOCK_AGENTS)
  useActivityStore.getState().setActivityFeed(MOCK_ACTIVITY)
  useTreasuryStore.getState().setTreasury(MOCK_TREASURY)
}
