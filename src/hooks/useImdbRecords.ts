import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryKeys } from '#/lib/query-keys.ts'

export interface ImdbRecordsResponse {
  success: boolean
  jobStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  jobProgress: number
  jobError: string | null
  records: any[]
  total: number
  page: number
  limit: number
}

/**
 * Custom hook to fetch IMDB records for a job with adaptive polling.
 * Supports server-side pagination.
 * As long as the job is in PENDING or PROCESSING status, it polls.
 * The polling interval backs off from 5s to 15s to prevent D1 database overload.
 */
export function useImdbRecords(
  orgId: string,
  jobId: string,
  pagination?: { pageIndex: number; pageSize: number },
) {
  return useQuery<ImdbRecordsResponse>({
    queryKey: [...queryKeys.records(orgId, jobId), pagination] as const,
    enabled: jobId !== 'dummy-no-job',
    queryFn: async () => {
      const params = new URLSearchParams()
      if (pagination) {
        params.set('page', String(pagination.pageIndex + 1))
        params.set('limit', String(pagination.pageSize))
      }
      const qs = params.toString()
      const url = qs ? `/api/jobs/${jobId}/records?${qs}` : `/api/jobs/${jobId}/records`

      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Failed to fetch records: ${res.statusText}`)
      }
      return await res.json()
    },
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 5000 // Default to 5s if not loaded yet
      
      const status = data.jobStatus
      // Only poll if the job is in PENDING or PROCESSING status
      if (status !== 'PENDING' && status !== 'PROCESSING') {
        return false
      }
      
      // Calculate age of query updates to back off poll rate
      const dataUpdatedAt = query.state.dataUpdatedAt ?? Date.now()
      const ageMs = Date.now() - dataUpdatedAt
      
      // Starts at 5s, scales up to 15s ceiling as the job runs longer
      return Math.max(5000, Math.min(15000, ageMs / 10))
    },
    staleTime: 10000, // 10s staleTime to prevent redundant refetches on focus/remount
    placeholderData: keepPreviousData,
  })
}
