import { Link } from '@tanstack/react-router'
import { Image as ImageIcon, ArrowRight } from 'lucide-react'
import { PipelineJobCard } from './PipelineJobCard.tsx'

export interface Job {
  id: string
  organisationId: string
  createdBy: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  progress: number
  imageCount: number
  visionModel: string | null
  inputTokens: number | null
  outputTokens: number | null
  totalCost: number | null
  startedAt: string | null
  completedAt: string | null
  error: string | null
}

interface JobListProps {
  jobs: Job[]
}

export function JobList({ jobs }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed border-neutral-800 rounded-3xl bg-neutral-950 text-center gap-3">
        <div className="p-3 bg-neutral-900 rounded-2xl text-neutral-500">
          <ImageIcon className="size-6" />
        </div>
        <div className="flex flex-col gap-1 max-w-xs">
          <p className="text-sm font-semibold text-neutral-200">No jobs processed yet</p>
          <p className="text-xs text-neutral-500">
            Upload product images on the Uploads page to start the extraction pipeline.
          </p>
        </div>
        <Link
          to="/dashboard/uploads"
          className="mt-2 text-xs font-bold text-indigo-400 hover:underline flex items-center gap-1"
        >
          Upload images <ArrowRight className="size-3" />
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {jobs.map((job) => (
        <PipelineJobCard key={job.id} job={job} />
      ))}
    </div>
  )
}
