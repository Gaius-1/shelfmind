import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryKeys } from '#/lib/query-keys.ts'

export interface RecordResponse {
  success: boolean
  record: any
}

/**
 * Custom hook to fetch a single record by recordId.
 * Uses keepPreviousData for smooth transitions when navigating between records.
 */
export function useRecord(orgId: string, recordId: string) {
  return useQuery<RecordResponse>({
    queryKey: queryKeys.record(orgId, recordId),
    queryFn: async () => {
      const res = await fetch(`/api/records/${recordId}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch record: ${res.statusText}`)
      }
      return await res.json()
    },
    staleTime: 10000, // 10s staleTime
    placeholderData: keepPreviousData,
  })
}
