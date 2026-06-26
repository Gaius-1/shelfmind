import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { PipelineVisualizer } from '#/components/pipeline/PipelineVisualizer.tsx'
import { Badge } from '#/components/reui/badge.tsx'
import { ArrowLeftIcon } from 'lucide-react'
import { getVisionModel, formatCost } from '#/lib/models.ts'

export const Route = createFileRoute('/dashboard/jobs/$jobId')({
  component: PipelineRoute,
})

function PipelineRoute() {
  const { jobId } = Route.useParams()

  const { data: jobData } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}`)
      if (!res.ok) throw new Error('Failed to fetch job')
      return res.json()
    },
    refetchInterval: (query) => {
      const job = query.state.data?.job
      if (!job) return false
      return (job.status === 'PENDING' || job.status === 'PROCESSING') ? 5000 : false
    }
  })

  const job = jobData?.job

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden h-[calc(100vh-theme(spacing.16))]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link to="/dashboard/processing-queue" className="text-muted-foreground hover:text-foreground transition-colors flex items-center">
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Pipeline Workflow</h1>
            {job && (
              <Badge variant="outline" className={`
                ${job.status === 'COMPLETED' ? 'bg-success/20 text-success-foreground' : 
                  job.status === 'FAILED' ? 'bg-destructive/20 text-destructive' : 
                  job.status === 'PROCESSING' ? 'bg-primary/20 text-primary-foreground animate-pulse' : 
                  'bg-muted text-muted-foreground'}
              `}>
                {job.status}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 ml-8">Live visualizer of the ShelfMind AI ingestion pipeline.</p>
        </div>
        {job && (
          <div className="flex items-center gap-6 text-sm text-muted-foreground text-right">
            <div>
              <span className="font-semibold text-foreground">Images:</span> {job.imageCount}
            </div>
            {job.visionModel && (
              <div>
                <span className="font-semibold text-foreground">Model:</span> {getVisionModel(job.visionModel).label}
              </div>
            )}
            {job.status === 'COMPLETED' && (
              <div>
                <span className="font-semibold text-foreground">Cost:</span> {formatCost(job.totalCost)}
                {(job.inputTokens != null || job.outputTokens != null) && (
                  <span className="ml-1 text-xs">
                    ({(job.inputTokens || 0).toLocaleString()} in / {(job.outputTokens || 0).toLocaleString()} out)
                  </span>
                )}
              </div>
            )}
            {job.startedAt && (
              <div>
                <span className="font-semibold text-foreground">Started:</span> {new Date(job.startedAt).toLocaleTimeString()}
              </div>
            )}
            {job.completedAt && (
              <div>
                <span className="font-semibold text-foreground">Completed:</span> {new Date(job.completedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <PipelineVisualizer jobId={jobId} />
      </div>
    </div>
  )
}
