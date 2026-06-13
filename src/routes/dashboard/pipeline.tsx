import { createFileRoute } from '@tanstack/react-router'
import { PipelineVisualizer } from '#/components/pipeline/PipelineVisualizer.tsx'

export const Route = createFileRoute('/dashboard/pipeline')({
  component: PipelineRoute,
})

function PipelineRoute() {
  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden h-[calc(100vh-theme(spacing.16))]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Pipeline Workflow</h1>
        <p className="text-muted-foreground mt-1">Live visualizer of the ShelfMind AI ingestion pipeline.</p>
      </div>
      <div className="flex-1 min-h-0 bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <PipelineVisualizer />
      </div>
    </div>
  )
}
