import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '#/lib/query-keys.ts'

export interface ProductsResponse {
  success: boolean
  records: any[]
}

/**
 * Custom hook to fetch products for an organization.
 * Supports optional search text and flagged-only filtering via query params.
 * Uses a 30s staleTime since product data changes less frequently.
 */
export function useProducts(
  orgId: string,
  filters?: { search?: string; flagged?: boolean },
) {
  return useQuery<ProductsResponse>({
    queryKey: [...queryKeys.products(orgId), filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.search) {
        params.set('search', filters.search)
      }
      if (filters?.flagged) {
        params.set('flagged', 'true')
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
  })
}
