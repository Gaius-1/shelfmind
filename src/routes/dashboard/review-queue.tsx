import * as React from 'react'
import { useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { useImdbRecords } from '#/hooks/useImdbRecords.ts'
import { useProducts } from '#/hooks/useProducts.ts'
import { useJobs } from '#/hooks/useJobs.ts'
import { ImdbTable } from '#/components/dashboard/ImdbTable.tsx'
import { Spinner } from '#/components/spinner.tsx'
import { AlertCircle, FileCheck, ShieldAlert, BadgeAlert } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { Frame, FramePanel } from '#/components/reui/frame.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select.tsx'

interface ReviewQueueSearch {
  jobId?: string
}

export const Route = createFileRoute('/dashboard/review-queue')({
  validateSearch: (search: Record<string, unknown>): ReviewQueueSearch => {
    return {
      jobId: search.jobId as string | undefined,
    }
  },
  head: () => ({
    meta: [
      { title: 'Review Queue - ShelfMind' },
      { name: 'description', content: 'Audit and approve extracted product data.' }
    ]
  }),
  component: ReviewQueuePage,
})

function ReviewQueuePage() {
  const { jobId } = Route.useSearch()
  const { data: activeOrg } = authClient.useActiveOrganization()

  if (!activeOrg) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return <ReviewQueueContent orgId={activeOrg.id} jobId={jobId} />
}

interface ContentProps {
  orgId: string
  jobId?: string
}

function ReviewQueueContent({ orgId, jobId }: ContentProps) {
  const navigate = useNavigate()
  
  // Fetch jobs for the dropdown selection filter
  const { data: jobsData } = useJobs(orgId)
  const completedJobs = (jobsData?.jobs || []).filter((j: any) => j.status === 'COMPLETED')

  // Condition 1: Specific Job ID selected
  const jobQuery = useImdbRecords(orgId, jobId || 'dummy-no-job')
  // Condition 2: No Job ID selected, show all flagged products
  const productsQuery = useProducts(orgId, { flagged: true })

  const isSpecificJob = !!jobId
  const isPending = isSpecificJob ? jobQuery.isPending : productsQuery.isPending
  const error = isSpecificJob ? jobQuery.error : productsQuery.error

  // Get records based on current view
  const records = useMemo(() => {
    if (isSpecificJob) {
      return jobQuery.data?.records || []
    }
    return productsQuery.data?.records || []
  }, [isSpecificJob, jobQuery.data, productsQuery.data])

  // Aggregate metrics for summary bar
  const metrics = useMemo(() => {
    if (records.length === 0) {
      return { total: 0, flagged: 0, avgConfidence: 0 }
    }
    const flaggedCount = records.filter((r: any) => r.flagged).length
    const totalConfidence = records.reduce((sum: number, r: any) => sum + (r.confidence || 0), 0)
    return {
      total: records.length,
      flagged: flaggedCount,
      avgConfidence: totalConfidence / records.length,
    }
  }, [records])

  const handleJobChange = (val: string) => {
    navigate({
      to: '/dashboard/review-queue',
      search: val && val !== 'all' ? { jobId: val } : {},
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50 font-heading">
            Flagged Review Queue
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            Verify extracted items. Red and amber indicators mark fields with low pipeline confidence.
          </p>
        </div>

        {/* Job Ingestion selector dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Filter Ingestion:
          </label>
          <Select value={jobId || 'all'} onValueChange={handleJobChange}>
            <SelectTrigger className="w-[240px] bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800/80 rounded-xl shadow-xs">
              <SelectValue placeholder="All Flagged Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Flagged Products</SelectItem>
              {completedJobs.map((job: any) => (
                <SelectItem key={job.id} value={job.id}>
                  Batch #{job.id.substring(0, 8)} ({job.imageCount} imgs)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metrics Summary Bar */}
      <Frame>
        <FramePanel className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border-0">
          {/* Metric 1 */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/30 rounded-xl shrink-0">
              <FileCheck className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Total in View</span>
              <span className="text-xl font-bold text-neutral-950 dark:text-neutral-50">{metrics.total}</span>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-neutral-200 dark:border-neutral-800 pt-4 sm:pt-0 sm:pl-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100/30 dark:border-amber-900/30 rounded-xl shrink-0">
              <BadgeAlert className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Low Confidence (Flagged)</span>
              <span className="text-xl font-bold text-neutral-950 dark:text-neutral-50">{metrics.flagged}</span>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-neutral-200 dark:border-neutral-800 pt-4 sm:pt-0 sm:pl-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/30 dark:border-emerald-900/30 rounded-xl shrink-0">
              <ShieldAlert className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Average Confidence</span>
              <span className="text-xl font-bold text-neutral-950 dark:text-neutral-50">
                {(metrics.avgConfidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </FramePanel>
      </Frame>

      {/* Main Review Table */}
      <div className="mt-2">
        {isPending ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-semibold mt-2 animate-pulse">
              Loading queue records...
            </p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            Failed to load queue records: {error.message}
          </div>
        ) : (
          <ImdbTable
            records={records}
            orgId={orgId}
            jobId={jobId || 'all'}
          />
        )}
      </div>
    </div>
  )
}
