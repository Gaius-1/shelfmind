import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '#/lib/query-keys.ts'

export interface Job {
  id: string
  organisationId: string
  createdBy: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  progress: number
  imageCount: number
  startedAt: string | null
  completedAt: string | null
  error: string | null
}

export interface JobsResponse {
  success: boolean
  jobs: Job[]
}

/**
 * Custom hook to fetch all jobs for an organization.
 * Automatically polls if there is at least one job running (PENDING or PROCESSING).
 */
export function useJobs(orgId: string) {
  return useQuery<JobsResponse>({
    queryKey: queryKeys.jobs(orgId),
    queryFn: async () => {
      const res = await fetch('/api/jobs/')
      if (!res.ok) {
        throw new Error(`Failed to fetch jobs: ${res.statusText}`)
      }
      return await res.json()
    },
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false

      const hasActiveJob = data.jobs.some(
        (job) => job.status === 'PENDING' || job.status === 'PROCESSING',
      )

      return hasActiveJob ? 5000 : false // poll every 5s if active job exists
    },
    staleTime: 15000, // 15s staleTime
  })
}
