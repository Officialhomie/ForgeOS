'use client'

import { isDemoMode } from '@/lib/demo'
import {
  MOCK_ACTIVITY,
  MOCK_AGENTS,
  MOCK_DELEGATIONS,
  MOCK_TREASURY,
} from '@/lib/mock-data'
import { useActivityStore } from '@/stores/activity.store'
import { useAgentsStore } from '@/stores/agents.store'
import { useDelegationsStore } from '@/stores/delegations.store'
import { useOsStore } from '@/stores/os.store'
import { useTreasuryStore } from '@/stores/treasury.store'

export function hydrateDemoStores(): void {
  if (!isDemoMode()) return

  useOsStore.setState({
    osStatus: 'active',
    rootDelegation: MOCK_DELEGATIONS.root,
    activationStep: 4,
  })
  useAgentsStore.setState({ agents: MOCK_AGENTS, loading: false })
  useDelegationsStore.setState({
    delegations: Object.values(MOCK_DELEGATIONS),
    loading: false,
  })
  useTreasuryStore.setState({ treasury: MOCK_TREASURY, loading: false })
  useActivityStore.setState({ activityFeed: MOCK_ACTIVITY })
}
