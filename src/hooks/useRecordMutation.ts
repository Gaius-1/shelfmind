import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '#/lib/query-keys.ts'

interface RecordMutationParams {
  orgId: string
  jobId: string
  recordId: string
}

interface RecordMutationVariables {
  fields: Record<string, string>
}

/**
 * Custom mutation hook to update a record's fields via PATCH.
 * On success it invalidates records, products, and stats caches so the UI
 * reflects the edit without a manual refetch.
 */
export function useRecordMutation({ orgId, jobId, recordId }: RecordMutationParams) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (variables: RecordMutationVariables) => {
      const res = await fetch(`/api/records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: variables.fields }),
      })
      if (!res.ok) {
        throw new Error(`Failed to update record: ${res.statusText}`)
      }
      return await res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.records(orgId, jobId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats(orgId) })
    },
  })
}
