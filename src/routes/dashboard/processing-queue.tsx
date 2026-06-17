import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { useJobs } from '#/hooks/useJobs.ts'
import { JobList } from '#/components/dashboard/JobList.tsx'
import { Spinner } from '#/components/spinner.tsx'

export const Route = createFileRoute('/dashboard/processing-queue')({
  head: () => ({
    meta: [
      { title: 'Processing Queue - ShelfMind' },
      { name: 'description', content: 'Track extraction pipeline queue runs in real-time.' }
    ]
  }),
  component: ProcessingQueuePage,
})

function ProcessingQueuePage() {
  const { data: activeOrg } = authClient.useActiveOrganization()

  if (!activeOrg) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return <ProcessingQueueContent orgId={activeOrg.id} />
}

function ProcessingQueueContent({ orgId }: { orgId: string }) {
  const { data: jobsData, isPending, error } = useJobs(orgId)

  const jobsList = jobsData?.jobs || []

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 font-heading">
          Pipeline Ingestion Queue
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
          Track historical and active ingestion jobs. Each row shows individual pipeline stage progress.
        </p>
      </div>

      {/* Content Area */}
      <div className="mt-2">
        {isPending ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-neutral-100 dark:bg-neutral-900 rounded-2xl animate-pulse border border-neutral-200 dark:border-neutral-800/50" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-900/30">
            Failed to load jobs list: {error.message}
          </div>
        ) : (
          <JobList jobs={jobsList} />
        )}
      </div>
    </div>
  )
}
