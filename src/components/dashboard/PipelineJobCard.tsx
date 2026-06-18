import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '#/lib/utils.ts'
import { usePipelineStream } from '#/hooks/usePipelineStream.ts'
import { initialNodes } from '#/types/pipeline.ts'
import type { CustomNodeData } from '#/components/pipeline/CustomNode.tsx'
import type { Job } from '#/hooks/useJobs.ts'
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Image as ImageIcon,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'

// Compact node titles for the horizontal pipeline bar
const NODE_SHORT_NAMES: Record<string, string> = {
  upload: 'Ingestion',
  ocr: 'OCR',
  watermark: 'Watermark',
  bgremoval: 'BG Removal',
  structured: 'Extraction',
  grouping: 'Grouping',
  database: 'DB Write',
  deduplication: 'Dedup',
}

// Node order for the pipeline
const NODE_ORDER = ['upload', 'ocr', 'watermark', 'bgremoval', 'structured', 'grouping', 'database', 'deduplication']

interface PipelineJobCardProps {
  job: Job
}

export function PipelineJobCard({ job }: PipelineJobCardProps) {
  const queryClient = useQueryClient()
  const [retrying, setRetrying] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)

  // For active/pending jobs, connect to the pipeline stream for real-time node status
  const isLive = job.status === 'PROCESSING' || job.status === 'PENDING'
  const { data: pipelineData } = usePipelineStream(isLive ? job.id : '')

  // Derive node statuses from pipeline data or job status
  const nodeStatuses = React.useMemo(() => {
    const statuses: Record<string, { status: string; title: string; description: string }> = {}

    if (pipelineData && isLive) {
      // Use live pipeline data
      for (const node of pipelineData.nodes) {
        const nodeData = node.data as CustomNodeData
        statuses[node.id] = {
          status: nodeData.status || 'pending',
          title: nodeData.title,
          description: nodeData.description,
        }
      }
    } else {
      // For completed/failed jobs, derive statuses from the overall job status
      for (const node of initialNodes) {
        const nodeData = node.data as CustomNodeData
        if (job.status === 'COMPLETED') {
          statuses[node.id] = { status: 'completed', title: nodeData.title, description: nodeData.description }
        } else if (job.status === 'FAILED') {
          statuses[node.id] = { status: 'failed', title: nodeData.title, description: nodeData.description }
        } else {
          statuses[node.id] = { status: 'pending', title: nodeData.title, description: nodeData.description }
        }
      }
    }
    return statuses
  }, [pipelineData, isLive, job.status])

  // Get logs for expanded view
  const nodeLogs = React.useMemo(() => {
    if (!pipelineData) return {}
    return pipelineData.logs || {}
  }, [pipelineData])

  const handleRetry = async () => {
    try {
      setRetrying(true)
      const res = await fetch(`/api/jobs/${job.id}/retry`, { method: 'POST' })
      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as any
        throw new Error(errorData.error || await res.text())
      }
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    } catch (err: any) {
      alert('Failed to retry job: ' + err.message)
    } finally {
      setRetrying(false)
    }
  }

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '-'
    const date = new Date(isoString)
    return date.toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    } as any)
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

  const isPending = job.status === 'PENDING'
  const isProcessing = job.status === 'PROCESSING'
  const isCompleted = job.status === 'COMPLETED'
  const isFailed = job.status === 'FAILED'

  // Count completed nodes for overall progress display
  const completedNodes = NODE_ORDER.filter(id => nodeStatuses[id]?.status === 'completed').length
  const activeNode = NODE_ORDER.find(id => nodeStatuses[id]?.status === 'active')
  const totalNodes = NODE_ORDER.length

  return (
    <div
      className={cn(
        "rounded-2xl border transition-all duration-300 overflow-hidden",
        "bg-neutral-950 border-neutral-800/60",
        isProcessing && "ring-1 ring-indigo-500/20 border-indigo-900/40",
        isFailed && "ring-1 ring-rose-500/20 border-rose-900/40",
      )}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono font-bold text-neutral-400 bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800/50">
            Batch #{job.id.substring(0, 8)}
          </span>

          <div className="h-4 w-px bg-neutral-800 hidden sm:block" />

          <span className="text-[11px] text-neutral-500 font-medium flex items-center gap-1.5">
            <ImageIcon className="size-3.5 text-neutral-600" />
            {job.imageCount} image{job.imageCount !== 1 && 's'}
          </span>

          {isProcessing && activeNode && (
            <>
              <div className="h-4 w-px bg-neutral-800 hidden sm:block" />
              <span className="text-[11px] text-indigo-400 font-semibold flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                {NODE_SHORT_NAMES[activeNode] || activeNode}
                <span className="text-neutral-600">({completedNodes}/{totalNodes})</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Timing info */}
          <div className="hidden sm:flex items-center gap-3 mr-3">
            {job.startedAt && (
              <span className="text-[10px] text-neutral-500 font-mono">
                {formatDate(job.startedAt)}
              </span>
            )}
            {(isProcessing || isCompleted) && (
              <span className={cn(
                "text-[10px] font-bold font-mono flex items-center gap-1",
                isProcessing ? "text-indigo-400" : "text-neutral-400"
              )}>
                <Clock className={cn("size-3", isProcessing && "animate-spin")} />
                {getDuration(job.startedAt, job.completedAt)}
              </span>
            )}
          </div>

          {/* Actions */}
          {isCompleted && (
            <div className="flex items-center gap-1.5">
              <Link
                to="/dashboard/jobs/$jobId"
                params={{ jobId: job.id } as any}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800 text-[10px] font-bold transition-all group"
              >
                Pipeline
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/dashboard/review-queue"
                search={{ jobId: job.id } as any}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-indigo-950/60 text-indigo-400 border border-indigo-800/40 hover:bg-indigo-900/60 text-[10px] font-bold transition-all"
              >
                <CheckCircle2 className="size-3" />
                Review
              </Link>
            </div>
          )}
          {isProcessing && (
            <Link
              to="/dashboard/jobs/$jobId"
              params={{ jobId: job.id } as any}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-amber-950/40 text-amber-400 border border-amber-800/30 hover:bg-amber-900/40 text-[10px] font-bold transition-all group"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
              </span>
              Live
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          {(isPending || isFailed) && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800 text-[10px] font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3", retrying && "animate-spin")} />
              Retry
            </button>
          )}

          {/* Expand/Collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center size-7 rounded-lg bg-neutral-900 text-neutral-500 border border-neutral-800 hover:bg-neutral-800 hover:text-neutral-300 transition-all"
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Pipeline Node Strip */}
      <div className="px-5 pb-4">
        <div className="flex gap-1">
          {NODE_ORDER.map((nodeId) => {
            const nodeInfo = nodeStatuses[nodeId]
            if (!nodeInfo) return null

            const status = nodeInfo.status
            const isNodeCompleted = status === 'completed'
            const isNodeActive = status === 'active'
            const isNodeFailed = status === 'failed'
            const isNodePending = status === 'pending'

            return (
              <div
                key={nodeId}
                className={cn(
                  "flex-1 flex flex-col gap-1 min-w-0",
                )}
              >
                {/* Node Label */}
                <div className="flex items-center justify-between px-0.5">
                  <span className={cn(
                    "text-[10px] font-semibold truncate",
                    isNodeCompleted && "text-neutral-300",
                    isNodeActive && "text-indigo-400",
                    isNodeFailed && "text-rose-400",
                    isNodePending && "text-neutral-600",
                  )}>
                    {NODE_SHORT_NAMES[nodeId] || nodeId}
                  </span>
                  {isNodeCompleted && (
                    <CheckCircle2 className="size-3 text-emerald-500 shrink-0 ml-1" />
                  )}
                  {isNodeActive && (
                    <Loader2 className="size-3 text-indigo-400 animate-spin shrink-0 ml-1" />
                  )}
                  {isNodeFailed && (
                    <AlertCircle className="size-3 text-rose-500 shrink-0 ml-1" />
                  )}
                </div>

                {/* Progress Bar */}
                <div className={cn(
                  "h-[6px] rounded-full overflow-hidden transition-all duration-300",
                  "bg-neutral-800/80",
                )}>
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      isNodeCompleted && "bg-emerald-500",
                      isNodeActive && "bg-indigo-500 animate-pulse",
                      isNodeFailed && "bg-rose-500",
                      isNodePending && "bg-transparent",
                    )}
                    style={{
                      width: isNodeCompleted ? '100%' : isNodeActive ? '60%' : isNodeFailed ? '100%' : '0%',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Error Message */}
      {isFailed && job.error && (
        <div className="mx-5 mb-4 flex items-start gap-2 p-3 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-400 text-[11px] font-medium">
          <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
          <div className="break-words">{job.error}</div>
        </div>
      )}

      {/* Expanded Log View */}
      {expanded && (
        <div className="border-t border-neutral-800/50 bg-neutral-950/80">
          <div className="px-5 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {NODE_ORDER.map((nodeId) => {
                const nodeInfo = nodeStatuses[nodeId]
                if (!nodeInfo) return null
                const logs = nodeLogs[nodeId] || []
                const status = nodeInfo.status
                const isNodeCompleted = status === 'completed'
                const isNodeActive = status === 'active'
                const isNodeFailed = status === 'failed'

                return (
                  <div
                    key={nodeId}
                    className={cn(
                      "rounded-xl border p-3 bg-neutral-900/60",
                      isNodeCompleted && "border-emerald-900/30",
                      isNodeActive && "border-indigo-900/30",
                      isNodeFailed && "border-rose-900/30",
                      !isNodeCompleted && !isNodeActive && !isNodeFailed && "border-neutral-800/40",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn(
                        "size-2 rounded-full",
                        isNodeCompleted && "bg-emerald-500",
                        isNodeActive && "bg-indigo-500 animate-pulse",
                        isNodeFailed && "bg-rose-500",
                        !isNodeCompleted && !isNodeActive && !isNodeFailed && "bg-neutral-700",
                      )} />
                      <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider">
                        {NODE_SHORT_NAMES[nodeId]}
                      </span>
                    </div>
                    <div className="max-h-24 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-700">
                      {logs.length === 0 ? (
                        <span className="text-[10px] text-neutral-600 italic">No logs yet</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {logs.slice(-5).map((log) => (
                            <div
                              key={log.id}
                              className={cn(
                                "text-[10px] font-mono leading-tight truncate",
                                log.type === 'error' && "text-rose-400",
                                log.type === 'success' && "text-emerald-400",
                                log.type === 'warning' && "text-amber-400",
                                log.type === 'info' && "text-neutral-400",
                              )}
                              title={log.message}
                            >
                              {log.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
