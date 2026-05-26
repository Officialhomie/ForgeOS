'use client'

import { create } from 'zustand'
import type { ActivityEvent } from '@/types'

interface ActivityStore {
  activityFeed: ActivityEvent[]
  lastUpdated: number | null
  setActivityFeed: (events: ActivityEvent[]) => void
  pushActivity: (event: ActivityEvent) => void
}

export const useActivityStore = create<ActivityStore>((set) => ({
  activityFeed: [],
  lastUpdated: null,
  setActivityFeed: (activityFeed) =>
    set({ activityFeed, lastUpdated: Math.floor(Date.now() / 1000) }),
  pushActivity: (event) =>
    set((state) => ({
      activityFeed: [event, ...state.activityFeed].slice(0, 50),
      lastUpdated: Math.floor(Date.now() / 1000),
    })),
}))
