import * as React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { IMDB_COLUMNS, EXCEL_HEADERS, type ImdbColumnName } from '#/types/imdb.ts'
import { useRecordMutation } from '#/hooks/useRecordMutation.ts'
import { Spinner } from '#/components/spinner.tsx'
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertTriangle,
  Barcode,
  FileText,
} from 'lucide-react'
import { QwenDark } from '#/components/ui/svgs/qwenDark.tsx'
import { QwenLight } from '#/components/ui/svgs/qwenLight.tsx'
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
  // Take the first image as the primary for evidence
  const currentImage = images[0]

  // Construct image retrieval URL
  const getImageUrl = (fileName: string) => {
    const key = `${orgId}/${jobId}/${fileName}`
    return `/api/jobs/files?bucket=PRODUCT_IMAGES&key=${encodeURIComponent(key)}`
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full p-6 lg:p-8">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold">
              {record.ITEM_NAME || 'Unnamed Product'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Lineage: {record.id.substring(0, 8)} • Group Key: {record.productGroupKey || 'None'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {record.flagged && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-destructive/10 text-destructive text-sm font-medium">
              <AlertTriangle className="size-4" />
              Needs Human Review
            </div>
          )}

          {/* Overall Confidence Indicator */}
          <div className="flex items-center gap-2 border px-4 py-1.5 rounded-md">
            <span className="text-sm font-medium">Record Quality:</span>
            <span className="text-sm font-bold">
              {(record.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Image & Evidence */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Image Viewer Card */}
          <Card>
            <CardHeader>
              <CardTitle>Source Images ({images.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {images.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {images.map((img: any, idx: number) => (
                    <div key={idx} className="relative aspect-square w-full rounded-md border flex items-center justify-center overflow-hidden">
                      <img
                        src={getImageUrl(img.fileName)}
                        alt={`Product extraction source ${idx + 1}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="aspect-square w-full rounded-md border flex items-center justify-center text-sm text-muted-foreground">
                  No source image available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Evidence panel */}
          <Card>
            <CardHeader>
              <CardTitle>Extraction Evidence</CardTitle>
              <CardDescription>
                Audit raw output from pipeline models
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Evidence tabs header */}
              <div className="flex gap-2">
                <Button
                  variant={evidenceTab === 'vision' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEvidenceTab('vision')}
                >
                  <QwenDark className="size-4 mr-2 hidden dark:block" />
                  <QwenLight className="size-4 mr-2 block dark:hidden" />
                  Qwen2.5-VL
                </Button>
                <Button
                  variant={evidenceTab === 'ocr' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEvidenceTab('ocr')}
                >
                  <FileText className="size-4 mr-2" />
                  Raw OCR
                </Button>
                <Button
                  variant={evidenceTab === 'zxing' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEvidenceTab('zxing')}
                >
                  <Barcode className="size-4 mr-2" />
                  ZXing
                </Button>
              </div>

              {/* Evidence tabs content */}
              <div className="bg-muted rounded-md p-4 text-sm font-mono max-h-[280px] overflow-y-auto">
                {evidenceTab === 'vision' && (
                  <pre className="whitespace-pre-wrap">
                    {currentImage?.vision
                      ? JSON.stringify(currentImage.vision, null, 2)
                      : '// No VLM Structured Extraction available'}
                  </pre>
                )}
                {evidenceTab === 'ocr' && (
                  <pre className="whitespace-pre-wrap">
                    {currentImage?.ocr || '// No raw OCR output available'}
                  </pre>
                )}
                {evidenceTab === 'zxing' && (
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground">Barcode Detector: ZXing (deterministic WASM)</p>
                    <p>
                      Detected: {currentImage?.zxing?.barcode ? (
                        <span className="font-bold">
                          {currentImage.zxing.barcode}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">None</span>
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
            <Card>
              <CardHeader>
                <CardTitle>Master Data Columns</CardTitle>
                <CardDescription>
                  Review and override extracted fields. Edited fields get 100% confidence.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {IMDB_COLUMNS.map((colName) => {
                  const metadata = record.fieldMetadata?.[colName]
                  const confidence = metadata?.confidence ?? 0
                  const source = metadata?.source ?? 'Merged'

                  return (
                    <div
                      key={colName}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center border-b pb-4 last:border-0 last:pb-0"
                    >
                      {/* Label + Source Pill */}
                      <div className="sm:col-span-4 flex flex-col gap-1.5">
                        <Label>
                          {EXCEL_HEADERS[colName]}
                        </Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-md">
                            {source}
                          </span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md border">
                            {(confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Field Value Input */}
                      <div className="sm:col-span-8">
                        <Input
                          value={formFields[colName]}
                          onChange={(e) => handleFieldChange(colName, e.target.value)}
                          placeholder={`Enter ${EXCEL_HEADERS[colName].toLowerCase()}...`}
                        />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Ingestion Submit and Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
              <div className="text-sm text-muted-foreground">
                {saveSuccess ? (
                  <span className="text-primary flex items-center gap-2">
                    <CheckCircle className="size-4" />
                    Record saved successfully!
                  </span>
                ) : (
                  <span>Saving recalculates the overall confidence score.</span>
                )}
              </div>

              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="size-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
