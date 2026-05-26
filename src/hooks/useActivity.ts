'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isDemoMode } from '@/lib/demo'
import { GRAPH_POLL_MS, isGraphEnabled } from '@/lib/graph/config'
import { queryGraph } from '@/lib/graph/client'
import { mapGraphActivity } from '@/lib/graph/mappers'
import { GET_ACTIVITY_FEED } from '@/lib/graph/queries'
import type { GraphActivityEvent } from '@/lib/graph/types'
import { MOCK_ACTIVITY } from '@/lib/mock-data'
import { useActivityStore } from '@/stores/activity.store'
import type { ActivityEvent } from '@/types'

interface ActivityResponse {
  activityEvents: GraphActivityEvent[]
}

export function useActivity(): {
  activity: ActivityEvent[]
  loading: boolean
} {
  const activityFeed = useActivityStore((s) => s.activityFeed)
  const setActivityFeed = useActivityStore((s) => s.setActivityFeed)

  const demo = isDemoMode()
  const graphOn = isGraphEnabled() && !demo

  const query = useQuery({
    queryKey: ['activity', 'graph'],
    queryFn: async () => {
      const data = await queryGraph<ActivityResponse>(GET_ACTIVITY_FEED, {
        first: 50,
      })
      return data.activityEvents.map(mapGraphActivity)
    },
    enabled: graphOn,
    refetchInterval: GRAPH_POLL_MS,
  })

  useEffect(() => {
    if (demo) {
      setActivityFeed(MOCK_ACTIVITY)
      return
    }
    if (!graphOn) {
      setActivityFeed(MOCK_ACTIVITY)
      return
    }
    if (query.data) {
      setActivityFeed(query.data)
    }
  }, [demo, graphOn, query.data, setActivityFeed])

  return {
    activity: activityFeed,
    loading: graphOn && query.isLoading,
  }
}
