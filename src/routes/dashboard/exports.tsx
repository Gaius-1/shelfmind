import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { useJobs } from '#/hooks/useJobs.ts'
import { Spinner } from '#/components/spinner.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table.tsx'
import { Download, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { MicrosoftExcel } from '#/components/ui/svgs/microsoftExcel.tsx'

export const Route = createFileRoute('/dashboard/exports')({
  head: () => ({
    meta: [
      { title: 'Export Center - ShelfMind' },
      { name: 'description', content: 'Generate and download Excel catalogs for database import.' }
    ]
  }),
  component: ExportsPage,
})

function ExportsPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()

  if (!activeOrg) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return <ExportsContent orgId={activeOrg.id} />
}

function ExportsContent({ orgId }: { orgId: string }) {
  const { data: jobsData, isPending } = useJobs(orgId)
  const completedJobs = (jobsData?.jobs || []).filter((j) => j.status === 'COMPLETED')

  const [exportingJobId, setExportingJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerateAndDownload = async (jobId: string) => {
    setExportingJobId(jobId)
    setError(null)

    try {
      const response = await fetch(`/api/jobs/${jobId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeMetadata: false }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(errData.error || `Export failed with status ${response.status}`)
      }

      const result = await response.json() as { success?: boolean; downloadUrl?: string }
      if (result.success && result.downloadUrl) {
        // Fetch as Blob to handle cross-origin URLs
        const fileResponse = await fetch(result.downloadUrl)
        if (!fileResponse.ok) {
          throw new Error('Failed to download file from server.')
        }
        const blob = await fileResponse.blob()
        const objectUrl = URL.createObjectURL(blob)

        // Automatically trigger download
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = `predictions_${jobId.substring(0, 8)}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // Clean up object URL
        URL.revokeObjectURL(objectUrl)
      } else {
        throw new Error('Server did not return a valid download link.')
      }
    } catch (err: any) {
      console.error('[ExportCenter] Export failed:', err)
      setError(err?.message || 'Failed to generate prediction spreadsheet.')
    } finally {
      setExportingJobId(null)
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="sr-only" role="status">Loading export batches...</span>
        <Spinner size="md" className="text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-10rem)] p-6 md:p-8 max-w-5xl mx-auto w-full gap-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
        <div className="flex items-center gap-4">
          <MicrosoftExcel className="size-10 sm:size-12 shrink-0 drop-shadow-sm" />
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-heading tracking-tight">
              Export Center
            </h1>
            <p className="text-xs sm:text-sm font-medium text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
              Generate structured Excel spreadsheets for your processed batches.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-sm font-medium animate-in slide-in-from-top-2">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
        {completedJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FileSpreadsheet className="size-10 text-neutral-300 dark:text-neutral-700 mb-4" />
            <p className="text-base font-semibold text-neutral-800 dark:text-neutral-200">No completed batches</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
              Process at least one image batch to enable spreadsheet exports.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <Table className="min-w-[600px]">
              <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/50">
                <TableRow>
                  <TableHead className="w-[120px] font-bold">Batch ID</TableHead>
                  <TableHead className="font-bold">Date Processed</TableHead>
                  <TableHead className="font-bold text-center">Items</TableHead>
                  <TableHead className="text-right font-bold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedJobs.map((job) => (
                  <TableRow key={job.id} className="group">
                    <TableCell className="font-medium text-neutral-700 dark:text-neutral-300">
                      #{job.id.substring(0, 8)}
                    </TableCell>
                    <TableCell className="text-neutral-500 dark:text-neutral-400">
                      {job.completedAt
                        ? new Date(job.completedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center font-medium text-neutral-600 dark:text-neutral-400">
                      {job.imageCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={exportingJobId === job.id}
                        onClick={() => handleGenerateAndDownload(job.id)}
                        aria-label={exportingJobId === job.id ? "Generating export" : "Download export"}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-400 font-bold transition-colors h-8 shrink-0 whitespace-nowrap"
                      >
                        {exportingJobId === job.id ? (
                          <>
                            <Spinner size="sm" className="sm:mr-2" />
                            <span className="hidden sm:inline">Generating...</span>
                          </>
                        ) : (
                          <>
                            <Download className="size-4 sm:size-3.5 sm:mr-1.5" />
                            <span className="hidden sm:inline">Download Excel</span>
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center">
        <p className="text-[11px] text-neutral-400 font-medium">
          Produces a 13-column ground-truth spreadsheet seamlessly integrated for database workflows.
        </p>
      </div>

    </div>
  )
}
