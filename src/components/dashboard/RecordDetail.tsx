import * as React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '#/components/ui/card.tsx'
import { IMDB_COLUMNS, EXCEL_HEADERS, type ImdbColumnName } from '#/types/imdb.ts'
import { useRecordMutation } from '#/hooks/useRecordMutation.ts'
import { Spinner } from '#/components/spinner.tsx'
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
  Barcode,
  FileText,
  Eye,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'

interface RecordDetailProps {
  record: any
  orgId: string
  jobId: string
}

export function RecordDetail({ record, orgId, jobId }: RecordDetailProps) {
  const navigate = useNavigate()
  
  // Local form state for the 13 fields
  const [formFields, setFormFields] = useState<Record<string, string>>(() => {
    const fields: Record<string, string> = {}
    IMDB_COLUMNS.forEach((col) => {
      fields[col] = record[col] || ''
    })
    return fields
  })

  // Watch for record changes
  useEffect(() => {
    const fields: Record<string, string> = {}
    IMDB_COLUMNS.forEach((col) => {
      fields[col] = record[col] || ''
    })
    setFormFields(fields)
  }, [record])

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [evidenceTab, setEvidenceTab] = useState<'zxing' | 'ocr' | 'vision'>('vision')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const mutation = useRecordMutation({ orgId, jobId, recordId: record.id })

  const handleFieldChange = (colName: string, val: string) => {
    setFormFields((prev) => ({
      ...prev,
      [colName]: val,
    }))
    setSaveSuccess(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveSuccess(false)
    
    try {
      await mutation.mutateAsync({ fields: formFields })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('[RecordDetail] Save failed:', err)
    }
  }

  const images = record.rawExtraction?.images || []
  const currentImage = images[activeImageIndex]

  // Construct image retrieval URL
  const getImageUrl = (fileName: string) => {
    const key = `${orgId}/${jobId}/${fileName}`
    return `/api/jobs/files?bucket=PRODUCT_IMAGES&key=${encodeURIComponent(key)}`
  }

  const getConfidenceColorClass = (score: number) => {
    if (score < 0.5) return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30'
    if (score < 0.75) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30'
    return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30'
  }

  const getOverallConfidenceColor = (score: number) => {
    if (score < 0.5) return 'bg-rose-500'
    if (score < 0.75) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full p-6 lg:p-8">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: `/dashboard/review-queue`, search: { jobId } as any })}
            className="rounded-xl h-10 px-3 border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 shadow-xs"
          >
            <ArrowLeft className="size-4 mr-1.5" />
            Back to Queue
          </Button>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-neutral-950 dark:text-neutral-50">
              {record.ITEM_NAME || 'Unnamed Product'}
            </h1>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Lineage: {record.id.substring(0, 8)} • Group Key: {record.productGroupKey || 'None'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {record.flagged && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/40 dark:border-amber-900/30 text-xs font-bold shadow-xs">
              <AlertTriangle className="size-4 shrink-0" />
              Needs Human Review
            </div>
          )}

          {/* Overall Confidence Indicator */}
          <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-1.5 rounded-xl shadow-xs">
            <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">Record Quality:</span>
            <span className="text-sm font-extrabold text-neutral-800 dark:text-neutral-100">
              {(record.confidence * 100).toFixed(0)}%
            </span>
            <div className="w-12 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${record.confidence * 100}%` }}
                className={cn("h-full rounded-full", getOverallConfidenceColor(record.confidence))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Image & Evidence */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Image Viewer Card */}
          <Card className="border border-neutral-200 dark:border-neutral-800/80 bg-white/40 dark:bg-neutral-950/20 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xs">
            <CardHeader className="p-4 border-b border-neutral-100 dark:border-neutral-900 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Source Images ({images.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-4">
              {images.length > 0 ? (
                <>
                  <div className="relative aspect-square w-full rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden flex items-center justify-center shadow-inner">
                    <img
                      src={getImageUrl(currentImage.fileName)}
                      alt="Product extraction source"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  {/* Image Selector Tabs */}
                  {images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1.5">
                      {images.map((img: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all shrink-0",
                            idx === activeImageIndex
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50"
                          )}
                        >
                          {img.fileName}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="aspect-square w-full rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-xs font-semibold text-neutral-400 dark:text-neutral-500">
                  No source image available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Evidence panel */}
          <Card className="border border-neutral-200 dark:border-neutral-800/80 bg-white/40 dark:bg-neutral-950/20 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xs">
            <CardHeader className="p-4 border-b border-neutral-100 dark:border-neutral-900">
              <CardTitle className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                Extraction Evidence
              </CardTitle>
              <CardDescription className="text-[11px] font-medium mt-1 text-neutral-400">
                Audit raw output from pipeline models
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-4">
              {/* Evidence tabs header */}
              <div className="flex p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl">
                <button
                  onClick={() => setEvidenceTab('vision')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                    evidenceTab === 'vision'
                      ? "bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  <Sparkles className="size-3.5" />
                  Qwen2.5-VL JSON
                </button>
                <button
                  onClick={() => setEvidenceTab('ocr')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                    evidenceTab === 'ocr'
                      ? "bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  <FileText className="size-3.5" />
                  Raw OCR
                </button>
                <button
                  onClick={() => setEvidenceTab('zxing')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                    evidenceTab === 'zxing'
                      ? "bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  <Barcode className="size-3.5" />
                  ZXing Scan
                </button>
              </div>

              {/* Evidence tabs content */}
              <div className="bg-neutral-900 text-neutral-100 rounded-xl p-3 text-xs font-mono max-h-[280px] overflow-y-auto border border-neutral-850 shadow-inner">
                {evidenceTab === 'vision' && (
                  <pre className="whitespace-pre-wrap leading-relaxed">
                    {currentImage?.vision
                      ? JSON.stringify(currentImage.vision, null, 2)
                      : '// No VLM Structured Extraction available'}
                  </pre>
                )}
                {evidenceTab === 'ocr' && (
                  <pre className="whitespace-pre-wrap leading-relaxed">
                    {currentImage?.ocr || '// No raw OCR output available'}
                  </pre>
                )}
                {evidenceTab === 'zxing' && (
                  <div className="flex flex-col gap-1 py-1 font-semibold text-neutral-300">
                    <p>Barcode Detector: ZXing (deterministic WASM)</p>
                    <div className="h-px bg-neutral-800 my-1.5" />
                    <p className="text-white text-sm font-mono mt-1">
                      Detected: {currentImage?.zxing?.barcode ? (
                        <span className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/30">
                          {currentImage.zxing.barcode}
                        </span>
                      ) : (
                        <span className="text-neutral-500 italic">None</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Editable master data fields */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <form onSubmit={handleSave} className="flex flex-col gap-6">
            <Card className="border border-neutral-200 dark:border-neutral-800/80 bg-white/40 dark:bg-neutral-950/20 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xs">
              <CardHeader className="p-5 border-b border-neutral-100 dark:border-neutral-900 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-neutral-850 dark:text-neutral-100">
                    Master Data Columns
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-neutral-400">
                    Review and override extracted fields. Edited fields get 100% confidence.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex flex-col gap-4">
                {IMDB_COLUMNS.map((colName) => {
                  const metadata = record.fieldMetadata?.[colName]
                  const confidence = metadata?.confidence ?? 0
                  const source = metadata?.source ?? 'Merged'

                  return (
                    <div
                      key={colName}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start border-b border-neutral-100 dark:border-neutral-900 pb-3 last:border-0 last:pb-0"
                    >
                      {/* Label + Source Pill */}
                      <div className="sm:col-span-4 flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide mt-1">
                          {EXCEL_HEADERS[colName]}
                        </label>
                        <div className="flex items-center gap-1.5">
                          {/* Source badge */}
                          <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-md">
                            {source}
                          </span>
                          
                          {/* Confidence score badge */}
                          <span className={cn(
                            "text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border",
                            getConfidenceColorClass(confidence)
                          )}>
                            {(confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Field Value Input */}
                      <div className="sm:col-span-8">
                        <input
                          type="text"
                          value={formFields[colName]}
                          onChange={(e) => handleFieldChange(colName, e.target.value)}
                          className={cn(
                            "w-full h-10 px-3 text-xs bg-white dark:bg-neutral-900 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-neutral-900 dark:text-neutral-50",
                            confidence < 0.5 && !mutation.isPending && "border-rose-200 dark:border-rose-900/40 bg-rose-50/10",
                            confidence >= 0.5 && confidence < 0.75 && !mutation.isPending && "border-amber-200 dark:border-amber-900/40 bg-amber-50/10",
                            confidence >= 0.75 && !mutation.isPending && "border-neutral-200 dark:border-neutral-800/80"
                          )}
                          placeholder={`Enter ${EXCEL_HEADERS[colName].toLowerCase()}...`}
                        />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Ingestion Submit and Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border border-neutral-200 dark:border-neutral-800 bg-white/40 dark:bg-neutral-950/20 backdrop-blur-xl rounded-3xl shadow-xs">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 text-center sm:text-left">
                {saveSuccess ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center sm:justify-start gap-1 font-bold animate-pulse">
                    <CheckCircle className="size-4" />
                    Record saved successfully! Recalculated confidence score.
                  </span>
                ) : (
                  <span>Saving recalculates the overall confidence score.</span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full sm:w-auto h-10 px-6 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/10 dark:shadow-indigo-500/10 flex items-center justify-center gap-2"
                >
                  {mutation.isPending ? (
                    <>
                      <Spinner size="sm" className="text-white" />
                      Saving changes...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Save Master Data overrides
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
