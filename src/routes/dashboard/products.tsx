import { useState, useDeferredValue } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { PaginationState } from '@tanstack/react-table'
import { authClient } from '#/lib/auth-client.ts'
import { useProducts } from '#/hooks/useProducts.ts'
import { ImdbTable } from '#/components/dashboard/ImdbTable.tsx'
import { Spinner } from '#/components/spinner.tsx'
import { AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/dashboard/products')({
  head: () => ({
    meta: [
      { title: 'Product Repository - ShelfMind' },
      { name: 'description', content: 'Central repository of all active product catalog master records.' }
    ]
  }),
  component: ProductsPage,
})

function ProductsPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()

  if (!activeOrg) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return <ProductsContent orgId={activeOrg.id} />
}

function ProductsContent({ orgId }: { orgId: string }) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 })
  const [searchInput, setSearchInput] = useState('')
  const search = useDeferredValue(searchInput)

  const { data: productsData, isPending, error } = useProducts(
    orgId,
    search ? { search } : undefined,
    pagination,
  )

  const records = productsData?.records || []
  const total = productsData?.total || 0
  const pageCount = total > 0 ? Math.ceil(total / pagination.pageSize) : 0

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50 font-heading">
          Product Master Repository
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
          Consolidated catalog of all active master records across all ingestion jobs. Soft-deleted and merged records are filtered out.
        </p>
      </div>

      {/* Table Area */}
      <div className="mt-2">
        {isPending && !productsData ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
            <p className="text-xs text-neutral-500 font-semibold mt-2 animate-pulse">
              Loading master repository...
            </p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            Failed to load product repository: {error.message}
          </div>
        ) : (
          <ImdbTable
            records={records}
            orgId={orgId}
            jobId="all"
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            searchValue={searchInput}
            onSearchChange={setSearchInput}
          />
        )}
      </div>
    </div>
  )
}
