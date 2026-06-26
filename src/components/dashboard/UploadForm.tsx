import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useFileUpload, formatBytes } from '#/hooks/use-file-upload.ts'
import { Button } from '#/components/ui/button.tsx'
import { Frame, FramePanel } from '#/components/reui/frame.tsx'
import { HugeiconsIcon } from '@hugeicons/react'
import { Upload01Icon, AlertCircleIcon, CloudUploadIcon, Delete02Icon, ImageIcon, CameraVideoIcon } from '@hugeicons/core-free-icons'
import { Alert, AlertDescription, AlertTitle } from '#/components/reui/alert.tsx'
import { Spinner } from '#/components/spinner.tsx'
import { cn } from '#/lib/utils.ts'
import { listVisionModels, DEFAULT_VISION_MODEL_ID } from '#/lib/models.ts'
import { CameraCapture } from './CameraCapture.tsx'

type InputMode = 'upload' | 'camera'

const VISION_MODELS = listVisionModels()
const MAX_FILES = 200
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = 'image/jpeg, image/png, image/webp'

export function UploadForm() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [
    { files, isDragging, errors },
    {
      addFiles,
      removeFile,
      clearFiles,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      getInputProps,
    },
  ] = useFileUpload({
    maxFiles: MAX_FILES,
    maxSize: MAX_FILE_SIZE,
    accept: ALLOWED_TYPES,
    multiple: true,
  })

  const [uploadProgress, setUploadProgress] = useState(0)
  const [inputMode, setInputMode] = useState<InputMode>('upload')
  const [visionModel, setVisionModel] = useState(DEFAULT_VISION_MODEL_ID)
  const selectedModel = VISION_MODELS.find((m) => m.id === visionModel) ?? VISION_MODELS[0]

  const submitBatch = async () => {
    if (files.length === 0 || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)
    setUploadProgress(0)

    try {
      // 1. Create the job first
      const createRes = await fetch('/api/jobs/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageCount: files.length, visionModel }),
      })

      if (!createRes.ok) {
        const data = (await createRes.json().catch(() => ({}))) as any
        throw new Error(data.error || 'Failed to initialize job')
      }

      const { jobId } = (await createRes.json()) as any

      // 2. Upload files in chunks of 5
      const CHUNK_SIZE = 5
      const totalChunks = Math.ceil(files.length / CHUNK_SIZE)

      for (let i = 0; i < totalChunks; i++) {
        const chunk = files.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        const formData = new FormData()
        
        for (const item of chunk) {
          if (item.file instanceof File) {
            formData.append('files', item.file)
          }
        }

        const uploadRes = await fetch(`/api/jobs/${jobId}/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          const data = (await uploadRes.json().catch(() => ({}))) as any
          throw new Error(data.error || `Failed to upload chunk ${i + 1}`)
        }
        
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100))
      }

      // 3. Start the pipeline
      const startRes = await fetch(`/api/jobs/${jobId}/start`, {
        method: 'POST',
      })

      if (!startRes.ok) {
        const data = (await startRes.json().catch(() => ({}))) as any
        throw new Error(data.error || 'Failed to start extraction pipeline')
      }

      navigate({ to: '/dashboard/processing-queue' })
    } catch (err: any) {
      console.error('[UploadForm] Submit failed:', err)
      setSubmitError(err?.message || 'Upload failed')
      setIsSubmitting(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Vision Model Selector */}
      <div className="rounded-2xl border border-border bg-card/50 p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-foreground">Vision Model</h3>
            <p className="text-xs text-muted-foreground font-medium">
              Choose the model used for extraction. Token usage and estimated cost are tracked per batch.
            </p>
          </div>
          <div className="text-right text-[11px] text-muted-foreground font-medium">
            <span className="font-semibold text-foreground">${selectedModel.pricing.inputPer1M.toFixed(2)}</span> / 1M in
            <span className="mx-1">·</span>
            <span className="font-semibold text-foreground">${selectedModel.pricing.outputPer1M.toFixed(2)}</span> / 1M out
          </div>
        </div>
        <select
          value={visionModel}
          onChange={(e) => setVisionModel(e.target.value)}
          disabled={isSubmitting}
          className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
        >
          {VISION_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — {m.provider}
            </option>
          ))}
        </select>
      </div>

      {/* Input mode toggle */}
      <div className="inline-flex w-full sm:w-auto self-start rounded-lg border border-border bg-card/50 p-1">
        <button
          type="button"
          onClick={() => setInputMode('upload')}
          disabled={isSubmitting}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
            inputMode === 'upload'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <HugeiconsIcon icon={Upload01Icon} className="size-4" />
          Upload Files
        </button>
        <button
          type="button"
          onClick={() => setInputMode('camera')}
          disabled={isSubmitting}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
            inputMode === 'camera'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <HugeiconsIcon icon={CameraVideoIcon} className="size-4" />
          Camera
        </button>
      </div>

      {inputMode === 'camera' ? (
        <CameraCapture onCapture={(file) => addFiles([file])} disabled={isSubmitting} />
      ) : (
        /* Drop Zone */
        <div
          className={cn(
            "relative rounded-2xl border-2 border-dashed p-10 text-center transition-colors bg-card/50 flex flex-col items-center justify-center cursor-pointer",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <input {...getInputProps()} className="sr-only" />

          <div className="flex flex-col items-center gap-5">
            <div
              className={cn(
                "bg-muted flex h-16 w-16 items-center justify-center rounded-full transition-colors",
                isDragging ? "bg-primary/10" : "bg-muted"
              )}
            >
              <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} className={cn("h-7 w-7", isDragging ? "text-primary" : "text-muted-foreground")} />
            </div>

            <div className="space-y-1.5 text-center">
              <h3 className="text-base font-semibold text-foreground">
                Drop images here or <span className="text-primary hover:underline underline-offset-4">browse files</span>
              </h3>
              <p className="text-xs text-muted-foreground font-medium max-w-md mx-auto">
                Supports PNG, JPG, JPEG, and WEBP. Maximum {MAX_FILES} images per batch. Max {formatBytes(MAX_FILE_SIZE)} per image.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {(errors.length > 0 || submitError) && (
        <Alert variant="destructive" className="mt-2">
          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
          <AlertTitle>File upload error</AlertTitle>
          <AlertDescription>
            {errors.map((error, index) => (
              <p key={index} className="last:mb-0 text-xs">{error}</p>
            ))}
            {submitError && <p className="text-xs font-semibold mt-1">{submitError}</p>}
          </AlertDescription>
        </Alert>
      )}

      {/* Image Grid Preview */}
      {files.length > 0 && (
        <Frame spacing="xs" className="w-full">
          <FramePanel className="bg-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                  {files.length}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  Images Ready for Extraction
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFiles}
                disabled={isSubmitting}
                className="text-xs text-muted-foreground hover:text-destructive h-8"
              >
                Clear All
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 max-h-[400px] overflow-y-auto pr-1">
              {files.map((fileItem) => (
                <div
                  key={fileItem.id}
                  className="group relative aspect-square rounded-xl border border-border bg-muted overflow-hidden"
                >
                  {fileItem.preview ? (
                    <img
                      src={fileItem.preview}
                      alt={fileItem.file instanceof File ? fileItem.file.name : fileItem.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <HugeiconsIcon icon={ImageIcon} className="size-6 text-muted-foreground/50" />
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
                    <p className="text-[10px] text-white truncate font-medium">
                      {fileItem.file instanceof File ? fileItem.file.name : fileItem.file.name}
                    </p>
                    <p className="text-[9px] text-white/70 font-semibold">
                      {formatBytes(fileItem.file.size)}
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => removeFile(fileItem.id)}
                    disabled={isSubmitting}
                    className="absolute top-2 right-2 size-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive transition-colors backdrop-blur-sm"
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-border mt-1">
              <Button
                onClick={submitBatch}
                disabled={isSubmitting}
                className="w-full sm:w-auto h-10 px-6 rounded-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" className="mr-2 border-primary-foreground border-t-transparent" />
                    {uploadProgress < 100 
                      ? `Uploading... ${uploadProgress}%` 
                      : `Starting pipeline...`}
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={CloudUploadIcon} className="size-4 mr-2" />
                    Start Extraction Pipeline
                  </>
                )}
              </Button>
            </div>
          </FramePanel>
        </Frame>
      )}
    </div>
  )
}
