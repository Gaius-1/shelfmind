import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { Calendar, Image as ImageIcon, AlertCircle, ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '#/lib/utils.ts'

export interface Job {
  id: string
  organisationId: string
  createdBy: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  progress: number
  imageCount: number
  startedAt: string | null
  completedAt: string | null
  error: string | null
}

interface JobListProps {
  jobs: Job[]
}

export function JobList({ jobs }: JobListProps) {
  const formatDate = (isoString: string | null) => {
    if (!isoString) return '-'
    const date = new Date(isoString)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getDuration = (start: string | null, end: string | null) => {
    if (!start) return null
    const startTime = new Date(start).getTime()
    const endTime = end ? new Date(end).getTime() : Date.now()
    const diffMs = endTime - startTime
    const diffSec = Math.floor(diffMs / 1000)
    
    if (diffSec < 60) return `${diffSec}s`
    const diffMin = Math.floor(diffSec / 60)
    const remSec = diffSec % 60
    return `${diffMin}m ${remSec}s`
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-3xl bg-card text-center gap-3">
        <div className="p-3 bg-muted rounded-2xl text-muted-foreground">
          <ImageIcon className="size-6" />
        </div>
        <div className="flex flex-col gap-1 max-w-xs">
          <p className="text-sm font-semibold text-foreground">No jobs processed yet</p>
          <p className="text-xs text-muted-foreground">
            Upload product images on the Uploads page to start the extraction pipeline.
          </p>
        </div>
        <Link
          to="/dashboard/uploads"
          className="mt-2 text-xs font-bold text-primary hover:underline flex items-center gap-1"
        >
          Upload images <ArrowRight className="size-3" />
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {jobs.map((job) => {
        const isPending = job.status === 'PENDING'
        const isProcessing = job.status === 'PROCESSING'
        const isCompleted = job.status === 'COMPLETED'
        const isFailed = job.status === 'FAILED'

        return (
          <Card
            key={job.id}
            className={cn(
              "border transition-all duration-200 bg-card rounded-2xl overflow-hidden hover:border-primary/50",
              isProcessing && "border-indigo-200 dark:border-indigo-950/40 ring-1 ring-indigo-500/10",
              isFailed && "border-rose-100 dark:border-rose-950/20"
            )}
          >
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="flex-1 flex flex-col gap-3.5">
                {/* Job Info Header */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-foreground bg-muted px-2.5 py-0.5 rounded-lg">
                    Batch #{job.id.substring(0, 8)}
                  </span>
                  
                  {/* Status pills */}
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1",
                      isPending && "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/40 dark:border-amber-900/30",
                      isProcessing && "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/40 dark:border-indigo-900/30 animate-pulse",
                      isCompleted && "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-900/30",
                      isFailed && "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/40 dark:border-rose-900/30"
                    )}
                  >
                    {isProcessing && <span className="size-1.5 rounded-full bg-indigo-500 animate-ping" />}
                    {job.status}
                  </span>

                  <div className="h-3 w-px bg-border hidden sm:block" />

                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <ImageIcon className="size-3.5 text-muted-foreground/70" />
                    {job.imageCount} product image{job.imageCount !== 1 && 's'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[11px] font-semibold text-muted-foreground">
                    <span>Extraction Progress</span>
                    <span>{job.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border">
                    <div
                      style={{ width: `${job.progress}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        isPending && "bg-amber-400 dark:bg-amber-500",
                        isProcessing && "bg-linear-to-r from-indigo-500 to-indigo-600 dark:from-indigo-500 dark:to-violet-500 animate-gradient",
                        isCompleted && "bg-emerald-500 dark:bg-emerald-600",
                        isFailed && "bg-rose-500"
                      )}
                    />
                  </div>
                </div>

                {/* Dates & Times */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3 text-muted-foreground/70" />
                    Started: {formatDate(job.startedAt)}
                  </span>
                  {job.completedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3 text-muted-foreground/70" />
                      Duration: {getDuration(job.startedAt, job.completedAt)}
                    </span>
                  )}
                  {isProcessing && (
                    <span className="flex items-center gap-1 text-indigo-500 dark:text-indigo-400 font-semibold">
                      <Clock className="size-3 text-indigo-400 animate-spin" />
                      Elapsed: {getDuration(job.startedAt, null)}
                    </span>
                  )}
                </div>

                {/* Error string if failed */}
                {isFailed && job.error && (
                  <div className="flex items-start gap-1.5 p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-900/20 text-rose-700 dark:text-rose-400 text-xs font-medium">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <div>Error: {job.error}</div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-end sm:pl-4">
                {isCompleted ? (
                  <Link
                    to="/dashboard/review-queue"
                    search={{ jobId: job.id } as any}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Review Records
                    <ArrowRight className="size-3" />
                  </Link>
                ) : isProcessing || isPending ? (
                  <Link
                    to="/dashboard/jobs/$jobId"
                    params={{ jobId: job.id } as any}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/40 dark:border-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-bold transition-all shadow-xs group"
                  >
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    View Live Pipeline
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ) : isFailed ? (
                  <span className="text-xs font-bold text-rose-500 px-3 py-1.5">
                    Failed Ingestion
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
