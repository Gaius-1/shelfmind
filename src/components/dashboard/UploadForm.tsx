import * as React from 'react'
import { useState, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { UploadCloud, X, FileImage, AlertTriangle, AlertCircle } from 'lucide-react'
import { Spinner } from '#/components/spinner.tsx'
import { cn } from '#/lib/utils.ts'

const MAX_FILES = 20
const MAX_FILE_SIZE_MB = 10
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function UploadForm() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [files, setFiles] = useState<File[]>([])
  const [isDragActive, setIsDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFiles = (newFiles: File[]): File[] => {
    const validFiles: File[] = []
    let hasInvalidType = false
    let hasInvalidSize = false

    for (const file of newFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        hasInvalidType = true
        continue
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        hasInvalidSize = true
        continue
      }
      validFiles.push(file)
    }

    if (hasInvalidType && hasInvalidSize) {
      setError(`Some files were skipped. Only PNG, JPG, and WEBP formats under ${MAX_FILE_SIZE_MB}MB are allowed.`)
    } else if (hasInvalidType) {
      setError('Some files were skipped. Only PNG, JPG, and WEBP image formats are supported.')
    } else if (hasInvalidSize) {
      setError(`Some files were skipped because they exceeded the ${MAX_FILE_SIZE_MB}MB size limit.`)
    }

    return validFiles
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true)
    } else if (e.type === 'dragleave') {
      setIsDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    setError(null)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files)
      const validFiles = validateFiles(droppedFiles)
      
      setFiles((prev) => {
        const combined = [...prev, ...validFiles]
        if (combined.length > MAX_FILES) {
          setError(`Maximum limit of ${MAX_FILES} files reached. Extra files were discarded.`)
          return combined.slice(0, MAX_FILES)
        }
        return combined
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    if (e.target.files && e.target.files[0]) {
      const selectedFiles = Array.from(e.target.files)
      const validFiles = validateFiles(selectedFiles)

      setFiles((prev) => {
        const combined = [...prev, ...validFiles]
        if (combined.length > MAX_FILES) {
          setError(`Maximum limit of ${MAX_FILES} files reached. Extra files were discarded.`)
          return combined.slice(0, MAX_FILES)
        }
        return combined
      })
    }
  }

  const removeFile = (index: number) => {
    setError(null)
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearAll = () => {
    setFiles([])
    setError(null)
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }

    try {
      const response = await fetch('/api/jobs/', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Upload failed with status ${response.status}`)
      }

      const result = await response.json()
      if (result.success && result.jobId) {
        // Redirect to processing-queue page
        navigate({ to: '/dashboard/processing-queue' })
      } else {
        throw new Error('Server returned unsuccessful upload response.')
      }
    } catch (err: any) {
      console.error('[UploadForm] Submit failed:', err)
      setError(err?.message || 'An unexpected error occurred during submission.')
      setIsUploading(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {error && (
        <div className="flex gap-2 items-start p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-xs font-medium animate-in fade-in-0 duration-200">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-200 transition-colors">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 text-center relative overflow-hidden",
          isDragActive
            ? "border-indigo-600 bg-indigo-50/20 dark:border-indigo-500 dark:bg-indigo-950/10 scale-[0.99] shadow-inner"
            : "border-neutral-300 dark:border-neutral-800 hover:border-indigo-500 dark:hover:border-indigo-600 bg-white/40 dark:bg-neutral-900/30 hover:bg-white dark:hover:bg-neutral-900/50",
          isUploading && "pointer-events-none opacity-50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100/30 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-xs">
          <UploadCloud className="size-8" />
        </div>
        <div className="flex flex-col gap-1 max-w-sm">
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Drag & drop product images, or <span className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">browse</span>
          </p>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
            Supports PNG, JPG, JPEG, and WEBP (Up to {MAX_FILES} images, max {MAX_FILE_SIZE_MB}MB per image)
          </p>
        </div>
      </div>

      {/* Preview Section */}
      {files.length > 0 && (
        <Card className="border border-neutral-200 dark:border-neutral-800/80 bg-white/40 dark:bg-neutral-950/20 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xs">
          <CardContent className="p-5 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-lg">
                  {files.length}
                </span>
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Files Selected
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={isUploading}
                className="text-xs font-bold text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 h-8 rounded-lg"
              >
                Clear All
              </Button>
            </div>

            {/* Grid Preview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[320px] overflow-y-auto pr-1">
              {files.map((file, index) => {
                const url = URL.createObjectURL(file)
                return (
                  <div
                    key={index}
                    className="group relative aspect-square rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 overflow-hidden shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800/60 transition-all duration-200"
                  >
                    <img
                      src={url}
                      alt={file.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onLoad={() => URL.revokeObjectURL(url)}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
                      <p className="text-[10px] text-white truncate font-medium">
                        {file.name}
                      </p>
                      <p className="text-[9px] text-neutral-300 font-semibold">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                      className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-600 dark:hover:bg-rose-500 transition-all shadow-xs"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Ingestion Submit */}
            <div className="flex justify-end pt-3 border-t border-neutral-100 dark:border-neutral-900">
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full sm:w-auto h-10 px-6 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/10 dark:shadow-indigo-500/10 flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Spinner size="sm" className="text-white" />
                    Uploading & Ingesting ({files.length})...
                  </>
                ) : (
                  <>
                    <FileImage className="size-4" />
                    Start Extraction Pipeline
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
