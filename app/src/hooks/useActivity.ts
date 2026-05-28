'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GRAPH_POLL_MS, isGraphEnabled } from '@/lib/graph/config'
import { queryGraph } from '@/lib/graph/client'
import { mapGraphActivity } from '@/lib/graph/mappers'
import { GET_ACTIVITY_FEED } from '@/lib/graph/queries'
import type { GraphActivityEvent } from '@/lib/graph/types'
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

  const graphOn = isGraphEnabled()

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
    if (!graphOn) return
    if (query.data) {
      setActivityFeed(query.data)
    }
  }, [graphOn, query.data, setActivityFeed])

  return {
    activity: activityFeed,
    loading: graphOn && query.isLoading,
  }
}
