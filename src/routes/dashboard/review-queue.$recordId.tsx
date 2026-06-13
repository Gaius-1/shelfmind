import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { useRecord } from '#/hooks/useRecord.ts'
import { RecordDetail } from '#/components/dashboard/RecordDetail.tsx'
import { Spinner } from '#/components/spinner.tsx'
import { AlertCircle } from 'lucide-react'

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

  if (!activeOrg) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return <RecordDetailContent orgId={activeOrg.id} recordId={recordId} />
}

interface ContentProps {
  orgId: string
  recordId: string
}

function RecordDetailContent({ orgId, recordId }: ContentProps) {
  const { data: recordData, isPending, error } = useRecord(orgId, recordId)

  const record = recordData?.record

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
    <RecordDetail
      record={record}
      orgId={orgId}
      jobId={record.jobId}
    />
  )
}
