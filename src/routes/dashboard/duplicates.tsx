import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { useDuplicates } from '#/hooks/useDuplicates.ts'
import { DuplicateCard } from '#/components/dashboard/DuplicateCard.tsx'
import { Spinner } from '#/components/spinner.tsx'
import { AlertCircle, CopyCheck, ShieldAlert } from 'lucide-react'

export const Route = createFileRoute('/dashboard/duplicates')({
  head: () => ({
    meta: [
      { title: 'Duplicate Pairs - ShelfMind' },
      { name: 'description', content: 'Resolve duplicate master data catalog candidates.' }
    ]
  }),
  component: DuplicatesPage,
})

function DuplicatesPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()

  if (!activeOrg) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return <DuplicatesContent orgId={activeOrg.id} />
}

function DuplicatesContent({ orgId }: { orgId: string }) {
  const { data: dupData, isPending, error } = useDuplicates(orgId)

  const pairs = dupData?.pairs || []

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50 font-heading">
          Duplicate Resolution Hub
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
          Audit candidate pairs identified by the duplicate detection engine. Merging consolidates fields into the parent and soft-deletes the duplicate for compliance audit trail.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="mt-2">
        {isPending ? (
          <div className="flex flex-col gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-56 bg-neutral-100 dark:bg-neutral-900 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            Failed to load duplicate pairs: {error.message}
          </div>
        ) : pairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl bg-white/30 dark:bg-neutral-900/10 text-center gap-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/30 dark:border-emerald-900/30 rounded-2xl shrink-0">
              <CopyCheck className="size-6" />
            </div>
            <div className="flex flex-col gap-1 max-w-xs">
              <p className="text-sm font-semibold text-neutral-850 dark:text-neutral-200">No pending duplicates</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                All records are unique! The post-job clustering engine will queue new candidates if duplicate brands, weights, or barcodes match on upcoming uploads.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {pairs.map((pair) => (
              <DuplicateCard key={pair.id} pair={pair} orgId={orgId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
