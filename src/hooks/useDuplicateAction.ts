import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '#/lib/query-keys.ts'

type DuplicateActionType = 'DISMISS' | 'MERGE'

interface DuplicateActionVariables {
  pairId: string
  action: DuplicateActionType
}

/**
 * Custom mutation hook to resolve a duplicate pair (dismiss or merge).
 * On success it invalidates duplicates, products, and stats caches so the UI
 * reflects the resolution without a manual refetch.
 */
export function useDuplicateAction(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ pairId, action }: DuplicateActionVariables) => {
      const res = await fetch(`/api/duplicates/${pairId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        throw new Error(`Failed to ${action.toLowerCase()} duplicate: ${res.statusText}`)
      }
      return await res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.duplicates(orgId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats(orgId) })
    },
  })
}
