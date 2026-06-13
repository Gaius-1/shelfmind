import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '#/lib/query-keys.ts'

export interface DuplicatePair {
  id: string
  similarityScore: number
  reason: 'BARCODE_MATCH' | 'BRAND_WEIGHT_MATCH' | string | null
  status: 'PENDING' | 'DISMISSED' | 'MERGED'
  recordA: any
  recordB: any
}

export interface DuplicatesResponse {
  success: boolean
  pairs: DuplicatePair[]
}

/**
 * Custom hook to fetch duplicate record pairs for an organization.
 * Uses a 60s staleTime since duplicates only update after job completion.
 */
export function useDuplicates(orgId: string) {
  return useQuery<DuplicatesResponse>({
    queryKey: queryKeys.duplicates(orgId),
    queryFn: async () => {
      const res = await fetch('/api/duplicates')
      if (!res.ok) {
        throw new Error(`Failed to fetch duplicates: ${res.statusText}`)
      }
      return await res.json()
    },
    staleTime: 60000, // 60s — duplicates update only after job completion
  })
}
