import { useQuery, keepPreviousData } from '@tanstack/react-query'
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
 * Supports optional search text, flagged-only filtering, and server-side pagination.
 * Uses a 30s staleTime since product data changes less frequently.
 */
export function useProducts(
  orgId: string,
  filters?: { search?: string; flagged?: boolean },
  pagination?: { pageIndex: number; pageSize: number },
) {
  return useQuery<ProductsResponse>({
    queryKey: [...queryKeys.products(orgId), filters, pagination] as const,
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
