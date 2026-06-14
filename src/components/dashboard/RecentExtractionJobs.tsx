import * as React from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { Frame, FramePanel } from '#/components/reui/frame.tsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table.tsx'
import { Badge } from '#/components/reui/badge.tsx'
import { Clock } from 'lucide-react'
import { cn } from '#/lib/utils.ts'

interface JobRow {
  id: string
  imageCount: number
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  avgConfidence?: number
  elapsed: string
}

interface RecentExtractionJobsProps {
  jobs: JobRow[]
}

const getStatusVariant = (status: JobRow['status']) => {
  switch (status) {
    case 'COMPLETED': return 'success-light'
    case 'PROCESSING': return 'info-light'
    case 'FAILED': return 'destructive-light'
    default: return 'warning-light'
  }
}

export function RecentExtractionJobs({ jobs }: RecentExtractionJobsProps) {
  const navigate = useNavigate()

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium text-foreground">Recent Extraction Jobs</h2>
          <p className="text-sm text-muted-foreground">Monitor real-time ingestion pipeline status.</p>
        </div>
        <Link 
          to="/dashboard/processing-queue"
          className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 group bg-indigo-50/50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-lg border border-indigo-100/50 dark:border-indigo-900/50 transition-colors"
        >
          View All Jobs
          <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
        </Link>
      </div>

      <Frame spacing="xs" className="flex-1">
        <FramePanel className="p-0! overflow-hidden flex-1 flex flex-col bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold h-10">Batch ID</TableHead>
                <TableHead className="font-semibold h-10">Images</TableHead>
                <TableHead className="font-semibold h-10">Status</TableHead>
                <TableHead className="font-semibold h-10 text-right">Confidence</TableHead>
                <TableHead className="font-semibold h-10 text-right pr-4">Elapsed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow 
                  key={job.id} 
                  className="border-border/50 group cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate({ to: '/dashboard/jobs/$jobId', params: { jobId: job.id } })}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">{job.id.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium">{job.imageCount}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(job.status)} size="sm">
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {job.avgConfidence ? (
                      <span className={cn(
                        "font-medium",
                        job.avgConfidence > 0.85 ? "text-success" : job.avgConfidence > 0.7 ? "text-warning" : "text-destructive"
                      )}>
                        {(job.avgConfidence * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1.5 text-muted-foreground text-sm">
                      <Clock className="size-3" />
                      <span>{job.elapsed}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No recent extraction jobs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </FramePanel>
      </Frame>
    </div>
  )
}
