import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { useStats } from '#/hooks/useStats.ts'
import { useJobs } from '#/hooks/useJobs.ts'

// Premium Dashboard Components
import { UploadBatchCard } from '#/components/dashboard/UploadBatchCard.tsx'
import { AnalyticsSparklines } from '#/components/dashboard/AnalyticsSparklines.tsx'
import { WeeklyReleases } from '#/components/dashboard/WeeklyReleases.tsx'
import { RecentExtractionJobs } from '#/components/dashboard/RecentExtractionJobs.tsx'
// import { GlobalWorkspaceConfidence } from '#/components/dashboard/GlobalWorkspaceConfidence.tsx'
// import { PipelineStorage } from '#/components/dashboard/PipelineStorage.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import { FlaggedReviewQueue } from '#/components/dashboard/FlaggedReviewQueue.tsx'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardHome,
})

function DashboardHome() {
  const { data: activeOrg, isPending } = authClient.useActiveOrganization()
  
  if (isPending || !activeOrg) {
    return (
      <div className="min-h-screen bg-background p-6 lg:p-8 w-full">
        <DashboardSkeleton />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8 w-full">
      <DashboardContent orgId={activeOrg.id} />
    </div>
  )
}

interface DashboardContentProps {
  orgId: string
}

function DashboardContent({ orgId }: DashboardContentProps) {
  const { data: statsData, isPending: isStatsPending } = useStats(orgId)
  const { data: jobsData, isPending: isJobsPending } = useJobs(orgId)

  const stats = statsData?.stats
  const jobs = jobsData?.jobs || []

  const isPending = isStatsPending || isJobsPending

  if (isPending) {
    return <DashboardSkeleton />
  }

  // Fallback stats if empty
  const activeStats = stats || {
    totalProducts: 0,
    meanConfidence: 0.91,
    flaggedCount: 0,
    totalJobs: 0,
    pendingDuplicates: 0,
  }

  // Convert generic job to JobRow expected by RecentExtractionJobs
  const recentJobsList = jobs.map(job => ({
    id: job.id,
    imageCount: job.imageCount,
    status: job.status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
    avgConfidence: 0.89, // Assuming avg per job is not directly on the job model yet, mockup has 0.89
    elapsed: '45s' // Mock elapsed
  }))

  return (
    <div className="max-w-[1600px] mx-auto w-full flex flex-col gap-6">
      
      {/* Grid Layout conforming to Premium Mockup */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 auto-rows-min">
        
        {/* Top Left: Upload Batch Card */}
        <div className="xl:col-span-4 xl:row-span-2 h-[450px] xl:h-auto">
          <UploadBatchCard />
        </div>

        {/* Top Right: Analytics Sparklines */}
        <div className="xl:col-span-8 min-h-[250px] flex flex-col">
          <AnalyticsSparklines 
            totalProducts={activeStats.totalProducts}
            avgConfidence={activeStats.meanConfidence}
            flaggedCount={activeStats.flaggedCount}
          />
        </div>

        {/* Middle Right: Weekly Releases */}
        <div className="xl:col-span-8 min-h-[100px]">
          <WeeklyReleases 
            weeklyJobs={jobs.filter(j => new Date(j.startedAt!).getTime() > Date.now() - 7*24*60*60*1000).length}
            totalJobs={activeStats.totalJobs}
          />
        </div>

        {/* Section Separator */}
        <div className="xl:col-span-12 py-2">
          <div className="w-full h-px bg-border/60" />
        </div>

        {/* Bottom Left: Recent Extraction Jobs */}
        <div className="xl:col-span-8 min-h-[350px]">
          <RecentExtractionJobs jobs={recentJobsList} />
        </div>

        {/* Bottom Right: Flagged Queue */}
        <div className="xl:col-span-4 flex flex-col h-full min-h-[350px]">
          <FlaggedReviewQueue orgId={orgId} />
        </div>

      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto w-full flex flex-col gap-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 auto-rows-min">
        {/* Top Left */}
        <div className="xl:col-span-4 xl:row-span-2 min-h-[450px] xl:h-auto">
          <Skeleton className="w-full h-full rounded-[2rem]" />
        </div>
        
        {/* Top Right */}
        <div className="xl:col-span-8 min-h-[250px]">
          <Skeleton className="w-full h-full rounded-[2rem]" />
        </div>
        
        {/* Middle Right */}
        <div className="xl:col-span-8 min-h-[100px]">
          <Skeleton className="w-full h-full rounded-[2rem]" />
        </div>
        
        {/* Bottom Left */}
        <div className="xl:col-span-8 h-[350px]">
          <Skeleton className="w-full h-full rounded-[2rem]" />
        </div>
        
        {/* Bottom Right Stacked */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <div className="flex-1 min-h-[220px]">
            <Skeleton className="w-full h-full rounded-[2rem]" />
          </div>
          <div className="shrink-0 h-[140px]">
            <Skeleton className="w-full h-full rounded-[2rem]" />
          </div>
        </div>
      </div>
    </div>
  )
}
