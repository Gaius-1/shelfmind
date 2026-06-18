import { createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { useRecord } from '#/hooks/useRecord.ts'
import { RecordDetail } from '#/components/dashboard/RecordDetail.tsx'
import { Spinner } from '#/components/spinner.tsx'
import { Button } from '#/components/ui/button.tsx'
import { AlertCircle, ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react'

export const Route = createFileRoute('/dashboard/review-queue/$recordId')({
  head: () => ({
    meta: [
      { title: 'Record Audit Detail - ShelfMind' },
      { name: 'description', content: 'Detailed audit evidence and field overrides for a master data record.' }
    ]
  }),
  component: RecordDetailPage,
})

function RecordDetailPage() {
  const { recordId } = Route.useParams()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const locationState = useRouterState({ select: (s) => s.location.state as { recordIds?: string[]; currentIndex?: number } })

  if (!activeOrg) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return <RecordDetailContent orgId={activeOrg.id} recordId={recordId} locationState={locationState} />
}

interface ContentProps {
  orgId: string
  recordId: string
  locationState: { recordIds?: string[]; currentIndex?: number }
}

function RecordDetailContent({ orgId, recordId, locationState }: ContentProps) {
  const navigate = useNavigate()
  const { data: recordData, isPending, error } = useRecord(orgId, recordId)

  const record = recordData?.record

  const { recordIds, currentIndex } = locationState
  const hasNavigation = recordIds && recordIds.length > 1 && typeof currentIndex === 'number'
  const canGoPrev = hasNavigation && currentIndex! > 0
  const canGoNext = hasNavigation && currentIndex! < recordIds!.length - 1

  if (isPending) {
    return (
      <div className="flex min-h-[400px] items-center justify-center flex-col gap-2">
        <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
        <p className="text-xs text-neutral-500 font-semibold animate-pulse">Loading audit evidence...</p>
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          Failed to load record details: {error?.message || 'Record not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto w-full">
      {/* Navigation bar */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/dashboard/review-queue' })}
          className="rounded-xl gap-1.5"
        >
          <ChevronLeft className="size-4" />
          Back to Queue
        </Button>

        {hasNavigation && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canGoPrev}
              onClick={() => {
                if (canGoPrev) {
                  navigate({
                    to: '/dashboard/review-queue/$recordId',
                    params: { recordId: recordIds![currentIndex! - 1] },
                    state: { recordIds, currentIndex: currentIndex! - 1 } as any,
                  })
                }
              }}
              className="rounded-xl"
            >
              <ArrowLeft className="size-3.5 mr-1" />
              Previous
            </Button>
            <span className="text-xs text-neutral-500 font-medium px-2">
              {currentIndex! + 1} of {recordIds!.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!canGoNext}
              onClick={() => {
                if (canGoNext) {
                  navigate({
                    to: '/dashboard/review-queue/$recordId',
                    params: { recordId: recordIds![currentIndex! + 1] },
                    state: { recordIds, currentIndex: currentIndex! + 1 } as any,
                  })
                }
              }}
              className="rounded-xl"
            >
              Next
              <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </div>
        )}
      </div>

      <RecordDetail
        record={record}
        orgId={orgId}
        jobId={record.jobId}
      />
    </div>
  )
}
