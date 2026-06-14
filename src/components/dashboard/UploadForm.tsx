import * as React from 'react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useFileUpload, formatBytes, type FileWithPreview } from '#/hooks/use-file-upload.ts'
import { Button } from '#/components/ui/button.tsx'
import { Frame, FramePanel } from '#/components/reui/frame.tsx'
import { HugeiconsIcon } from '@hugeicons/react'
import { Upload01Icon, AlertCircleIcon, CloudUploadIcon, Delete02Icon, ImageIcon } from '@hugeicons/core-free-icons'
import { Alert, AlertDescription, AlertTitle } from '#/components/reui/alert.tsx'
import { Spinner } from '#/components/spinner.tsx'
import { cn } from '#/lib/utils.ts'

const MAX_FILES = 20
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = 'image/jpeg, image/png, image/webp'

export function UploadForm() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [
    { files, isDragging, errors },
    {
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

  const submitBatch = async () => {
    if (files.length === 0 || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)

    const formData = new FormData()
    for (const item of files) {
      if (item.file instanceof File) {
        formData.append('files', item.file)
      }
    }

    try {
      const response = await fetch('/api/jobs/', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Upload failed')
      }

      const result = await response.json()
      if (result.success && result.jobId) {
        navigate({ to: '/dashboard/processing-queue' })
      } else {
        throw new Error('Server returned unsuccessful upload response.')
      }
    } catch (err: any) {
      console.error('[UploadForm] Submit failed:', err)
      setSubmitError(err?.message || 'Upload failed')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Drop Zone */}
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
                    Uploading & Ingesting ({files.length})...
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
