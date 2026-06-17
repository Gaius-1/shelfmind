import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '#/lib/query-keys.ts'

export interface StatsResponse {
  success: boolean
  stats: {
    totalProducts: number
    meanConfidence: number
    flaggedCount: number
    totalJobs: number
    pendingDuplicates: number
    weeklyJobs: number
    thisMonthJobs: number
    lastMonthJobs: number
  }
  daily?: {
    products: { time: string; value: number }[]
    confidence: { time: string; value: number }[]
    flagged: { time: string; value: number }[]
  }
}

/**
 * Custom hook to fetch aggregate stats for an organization.
 * Uses a 30s staleTime for a balance between freshness and D1 load.
 */
export function useStats(orgId: string) {
  return useQuery<StatsResponse>({
    queryKey: queryKeys.stats(orgId),
    queryFn: async () => {
      const res = await fetch('/api/stats')
      if (!res.ok) {
        throw new Error(`Failed to fetch stats: ${res.statusText}`)
      }
      return await res.json()
    },
    staleTime: 30000, // 30s
  })
}
