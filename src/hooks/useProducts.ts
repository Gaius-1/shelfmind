import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { SortingState } from '@tanstack/react-table'
import { queryKeys } from '#/lib/query-keys.ts'

export interface ProductsResponse {
  success: boolean
  records: any[]
  total: number
  page: number
  limit: number
}

/**
 * Custom hook to fetch products for an organization.
 * Supports optional search text, flagged-only filtering, server-side pagination, and server-side sorting.
 * Uses a 30s staleTime since product data changes less frequently.
 */
export function useProducts(
  orgId: string,
  filters?: { search?: string; flagged?: boolean },
  pagination?: { pageIndex: number; pageSize: number },
  sorting?: SortingState,
) {
  return useQuery<ProductsResponse>({
    queryKey: [...queryKeys.products(orgId), filters, pagination, sorting] as const,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.search) {
        params.set('search', filters.search)
      }
      if (filters?.flagged) {
        params.set('flagged', 'true')
      }
      if (pagination) {
        params.set('page', String(pagination.pageIndex + 1))
        params.set('limit', String(pagination.pageSize))
      }
      if (sorting && sorting.length > 0) {
        params.set('sortBy', sorting[0].id)
        params.set('sortDir', sorting[0].desc ? 'desc' : 'asc')
      }

      const qs = params.toString()
      const url = qs ? `/api/products?${qs}` : '/api/products'

      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Failed to fetch products: ${res.statusText}`)
      }
      return await res.json()
    },
    staleTime: 30000, // 30s — product data changes less frequently
    placeholderData: keepPreviousData,
  })
}
