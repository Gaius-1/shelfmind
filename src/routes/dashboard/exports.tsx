import * as React from 'react'
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { useJobs } from '#/hooks/useJobs.ts'
import { Spinner } from '#/components/spinner.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select.tsx'
import { Checkbox } from '#/components/ui/checkbox.tsx'
import { Label } from '#/components/ui/label.tsx'
import { FileSpreadsheet, Download, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'

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

  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [includeMetadata, setIncludeMetadata] = useState(false)
  
  const [isExporting, setIsExporting] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  React.useEffect(() => {
    if (completedJobs.length > 0 && !selectedJobId) {
      setSelectedJobId(completedJobs[0].id)
    }
  }, [completedJobs, selectedJobId])

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedJobId) return
    
    setIsExporting(true)
    setError(null)
    setDownloadUrl(null)

    try {
      const response = await fetch(`/api/jobs/${selectedJobId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeMetadata }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(errData.error || `Export failed with status ${response.status}`)
      }

      const result = await response.json() as { success?: boolean; downloadUrl?: string }
      if (result.success && result.downloadUrl) {
        setDownloadUrl(result.downloadUrl)
      } else {
        throw new Error('Server did not return a valid download link.')
      }
    } catch (err: any) {
      console.error('[ExportCenter] Export failed:', err)
      setError(err?.message || 'Failed to generate prediction spreadsheet.')
    } finally {
      setIsExporting(false)
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="md" className="text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-6 w-full">
      <div className="w-full max-w-md border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-xl flex flex-col items-center gap-6 shadow-sm">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex items-center justify-center size-14 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
            <FileSpreadsheet className="size-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 font-heading tracking-tight">
              Export Center
            </h1>
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mt-1.5">
              Generate ERP-ready prediction spreadsheets
            </p>
          </div>
        </div>

        {/* Content */}
        {completedJobs.length === 0 ? (
          <div className="flex flex-col items-center text-center p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl w-full border border-neutral-100 dark:border-neutral-800">
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">No completed batches</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Process at least one image batch to enable exports.
            </p>
          </div>
        ) : (
          <form onSubmit={handleExport} className="w-full flex flex-col gap-6">
            
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                Select Ingestion Batch
              </Label>
              <Select value={selectedJobId} onValueChange={(val) => {
                setSelectedJobId(val)
                setDownloadUrl(null)
                setError(null)
              }}>
                <SelectTrigger className="w-full h-11 bg-white dark:bg-neutral-900">
                  <SelectValue placeholder="Select a batch..." />
                </SelectTrigger>
                <SelectContent>
                  {completedJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      Batch #{job.id.substring(0, 8)} ({job.imageCount} products)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-3 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800/80">
              <Checkbox 
                id="meta" 
                checked={includeMetadata} 
                onCheckedChange={(checked) => {
                  setIncludeMetadata(checked === true)
                  setDownloadUrl(null)
                }}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-1">
                <Label htmlFor="meta" className="text-sm font-semibold cursor-pointer text-neutral-800 dark:text-neutral-200">
                  Include confidence metadata
                </Label>
                <p className="text-xs text-neutral-500 dark:text-neutral-450 leading-relaxed">
                  Appends CONFIDENCE (%) and FLAGGED (YES/NO) columns to the spreadsheet.
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-sm font-medium">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {downloadUrl ? (
              <div className="flex flex-col gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="size-4" />
                  Export ready for download
                </div>
                <a
                  href={downloadUrl}
                  download="predictions.xlsx"
                  className="flex items-center justify-center gap-2 h-11 w-full rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <Download className="size-4" />
                  Download Excel File
                </a>
              </div>
            ) : (
              <Button
                type="submit"
                disabled={isExporting}
                className="w-full h-11 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-600/10"
              >
                {isExporting ? (
                  <>
                    <Spinner size="sm" className="mr-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Generate Export
                  </>
                )}
              </Button>
            )}
            
            <p className="text-[11px] text-center text-neutral-400 font-medium">
              Produces a 13-column ground-truth spreadsheet for ERP systems.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

