import { useQuery } from '@tanstack/react-query'
import { authClient } from '#/lib/auth-client.ts'
import { queryKeys } from '#/lib/query-keys.ts'

/**
 * Custom hook to retrieve and cache the Better Auth session using TanStack Query.
 * Uses a 5-minute staleTime to avoid hitting D1 on every sub-navigation.
 */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session(),
    queryFn: async () => {
      const res = await authClient.getSession()
      if (res.error) {
        throw new Error(res.error.message || 'Failed to fetch session')
      }
      return res.data // Contains session and user
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  })
}
