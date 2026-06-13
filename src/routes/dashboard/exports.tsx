import * as React from 'react'
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { useJobs } from '#/hooks/useJobs.ts'
import { Spinner } from '#/components/spinner.tsx'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '#/components/ui/card.tsx'
import { Button } from '#/components/ui/button.tsx'
import { FileSpreadsheet, Download, CheckCircle, Info, Database, AlertCircle, Sparkles } from 'lucide-react'
import { cn } from '#/lib/utils.ts'

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

  const [selectedJobId, setSelectedJobId] = useState('')
  const [includeMetadata, setIncludeMetadata] = useState(false)
  
  const [isExporting, setIsExporting] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Initialize selected job to first completed job if none selected
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
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Export failed with status ${response.status}`)
      }

      const result = await response.json()
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

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50 font-heading">
          Export Center
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
          Generate structured ground-truth predictions spreadsheets ready for ERP ingestion or database upload.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Export Controls */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <Card className="border border-neutral-200 dark:border-neutral-800/80 bg-white/40 dark:bg-neutral-900/10 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xs">
            <CardHeader className="p-5 border-b border-neutral-100 dark:border-neutral-900">
              <CardTitle className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
                Generate Ingestion Spreadsheet
              </CardTitle>
              <CardDescription className="text-xs font-medium text-neutral-400 mt-1">
                Configure your export template parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {isPending ? (
                <div className="flex items-center justify-center p-8">
                  <Spinner size="md" className="text-indigo-500" />
                </div>
              ) : completedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl gap-3">
                  <div className="p-3 bg-neutral-100 dark:bg-neutral-900 rounded-xl text-neutral-400">
                    <FileSpreadsheet className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1 max-w-xs">
                    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">No completed jobs to export</p>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium leading-relaxed">
                      You must have at least one successfully processed batch of product images to perform an export.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleExport} className="flex flex-col gap-5">
                  {/* Select Job */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                      Select Ingestion Batch
                    </label>
                    <select
                      value={selectedJobId}
                      onChange={(e) => {
                        setSelectedJobId(e.target.value)
                        setDownloadUrl(null)
                        setError(null)
                      }}
                      className="h-10 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-neutral-700 dark:text-neutral-300 shadow-xs"
                    >
                      {completedJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          Batch #{job.id.substring(0, 8)} ({job.imageCount} products • processed: {new Date(job.completedAt || '').toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Template parameters */}
                  <div className="flex flex-col gap-2.5">
                    <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                      Export Template Details
                    </label>
                    
                    <div className="flex flex-col gap-2 p-3 rounded-2xl bg-neutral-50/50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/40 text-xs font-semibold text-neutral-600 dark:text-neutral-450">
                      <div className="flex justify-between items-center py-1">
                        <span>Output Format</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">Excel Workbook (.xlsx)</span>
                      </div>
                      <div className="h-px bg-neutral-200/50 dark:bg-neutral-800/50" />
                      <div className="flex justify-between items-center py-1">
                        <span>Schema Alignment</span>
                        <span>13-Column Ground Truth (SAP / ERP ready)</span>
                      </div>
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="flex items-start gap-2.5 p-1">
                    <input
                      type="checkbox"
                      id="meta"
                      checked={includeMetadata}
                      onChange={(e) => {
                        setIncludeMetadata(e.target.checked)
                        setDownloadUrl(null)
                      }}
                      className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 mt-1 cursor-pointer"
                    />
                    <label htmlFor="meta" className="flex flex-col cursor-pointer select-none">
                      <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                        Include confidence metadata columns
                      </span>
                      <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 leading-normal">
                        Appends a CONFIDENCE (%) and FLAGGED (YES/NO) column to the spreadsheet template.
                      </span>
                    </label>
                  </div>

                  {/* Actions */}
                  {error && (
                    <div className="flex items-start gap-1.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-150/40 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      <div>{error}</div>
                    </div>
                  )}

                  {downloadUrl ? (
                    <div className="flex flex-col gap-3.5 p-4 bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-200/40 dark:border-emerald-900/30 rounded-2xl text-emerald-800 dark:text-emerald-300 text-xs font-medium animate-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-2 font-bold">
                        <CheckCircle className="size-4 text-emerald-500" />
                        Predictions workbook generated successfully!
                      </div>
                      <a
                        href={downloadUrl}
                        download="predictions.xlsx"
                        className="flex items-center justify-center gap-1.5 h-10 w-full sm:w-auto px-5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/10 dark:shadow-emerald-500/10 self-end"
                      >
                        <Download className="size-4" />
                        Download predictions.xlsx
                      </a>
                    </div>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isExporting}
                      className="w-full h-10 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/10 dark:shadow-indigo-500/10 flex items-center justify-center gap-2"
                    >
                      {isExporting ? (
                        <>
                          <Spinner size="sm" className="text-white" />
                          Generating Excel workbook predictions...
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4" />
                          Compile Export Template
                        </>
                      )}
                    </Button>
                  )}
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Ingestion Guide */}
        <div className="lg:col-span-5">
          <Card className="border border-neutral-200 dark:border-neutral-800/80 bg-white/40 dark:bg-neutral-900/10 backdrop-blur-xl rounded-3xl shadow-xs">
            <CardHeader className="p-5 border-b border-neutral-100 dark:border-neutral-900">
              <CardTitle className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
                <Database className="size-4 text-indigo-500" />
                ERP Master Data Mapping
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-col gap-4 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
              <div className="flex flex-col gap-2 bg-neutral-50/50 dark:bg-neutral-900/40 p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-800/40 leading-relaxed">
                <p className="font-bold text-neutral-850 dark:text-neutral-200 mb-1">Standard 13-Column Hierarchy</p>
                <p className="font-medium text-[11px] text-neutral-500">
                  ShelfMind outputs predictions aligning directly with major Item Master Database (IMDB) retail catalogs.
                </p>
                <div className="h-px bg-neutral-250 dark:bg-neutral-800 my-1.5" />
                <ul className="list-disc list-inside flex flex-col gap-1 text-[11px] font-medium text-neutral-500 pl-1">
                  <li><span className="font-bold text-neutral-700 dark:text-neutral-300">ITEM_NAME</span>: Primary product designation</li>
                  <li><span className="font-bold text-neutral-700 dark:text-neutral-300">BARCODE</span>: ZXing deterministic UPC/EAN scan</li>
                  <li><span className="font-bold text-neutral-700 dark:text-neutral-300">WEIGHT</span>: Cleaned normalized size (e.g. 500g, 1.5l)</li>
                  <li><span className="font-bold text-neutral-700 dark:text-neutral-300">PACKAGING TYPE</span>: Normalized type (e.g. Box, Bottle)</li>
                </ul>
              </div>

              <div className="flex gap-2 items-start p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-150/30 dark:border-indigo-900/20 rounded-2xl text-[11px] font-medium text-indigo-800 dark:text-indigo-400">
                <Info className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Pro Tip:</span> In database imports, map the column headers exactly. ShelfMind automatically normalizes packing labels and strips secondary languages to ensure 99% ERD match.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
