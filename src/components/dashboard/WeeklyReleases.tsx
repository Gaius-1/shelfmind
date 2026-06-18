import { Frame, FramePanel } from '#/components/reui/frame.tsx'
import { Badge } from '#/components/reui/badge.tsx'
import { HugeiconsIcon } from '@hugeicons/react'
import { TradeUpIcon, Rocket02Icon } from '@hugeicons/core-free-icons'

interface WeeklyReleasesProps {
  weeklyJobs: number
  totalJobs: number
}

export function WeeklyReleases({ weeklyJobs, totalJobs }: WeeklyReleasesProps) {
  return (
    <Frame spacing="xs" className="w-full h-full">
      <FramePanel className="w-full h-full p-6 flex flex-row items-center justify-between gap-6 overflow-hidden bg-card border-none shadow-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center size-12 shrink-0 rounded-2xl bg-primary/10 text-primary">
            <HugeiconsIcon icon={Rocket02Icon} strokeWidth={2} className="size-6" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-[15px] font-semibold text-foreground leading-tight">Weekly Releases</h3>
            <p className="text-sm text-muted-foreground font-medium">{weeklyJobs} jobs processed this week.</p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2 shrink-0 text-right">
          <div className="text-3xl font-bold tracking-tight text-foreground">{totalJobs}</div>
          <Badge variant="success-light" className="rounded-md">
            <HugeiconsIcon icon={TradeUpIcon} strokeWidth={2} className="size-3 mr-1" />
            +18% M/M
          </Badge>
        </div>
      </FramePanel>
    </Frame>
  )
}
