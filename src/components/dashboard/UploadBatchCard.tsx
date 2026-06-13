import * as React from 'react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  formatBytes,
  useFileUpload,
  type FileWithPreview,
} from "#/hooks/use-file-upload.ts"
import { Badge } from "#/components/reui/badge.tsx"
import { cn } from "#/lib/utils.ts"
import { Button } from "#/components/ui/button.tsx"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx"
import { HugeiconsIcon } from "@hugeicons/react"
import { 
  ImageIcon, 
  Upload01Icon, 
  CloudUploadIcon, 
  Delete02Icon, 
  AlertCircleIcon 
} from "@hugeicons/core-free-icons"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "#/components/reui/alert.tsx"
import { Frame, FramePanel } from "#/components/reui/frame.tsx"

interface FileUploadItem extends FileWithPreview {
  progress: number
  status: "uploading" | "completed" | "error" | "pending"
  error?: string
}

const MAX_FILES = 20
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = "image/jpeg, image/png, image/webp"

export function UploadBatchCard() {
  const navigate = useNavigate()
  
  const [uploadFiles, setUploadFiles] = useState<FileUploadItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [
    { isDragging, errors },
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
    onFilesChange: (newFiles) => {
      const newUploadFiles = newFiles.map((file) => {
        const existingFile = uploadFiles.find((existing) => existing.id === file.id)
        if (existingFile) {
          return { ...existingFile, ...file }
        } else {
          return {
            ...file,
            progress: 0,
            status: "pending" as const,
          }
        }
      })
      setUploadFiles(newUploadFiles)
    },
  })

  const removeUploadFile = (fileId: string) => {
    setUploadFiles((prev) => prev.filter((file) => file.id !== fileId))
    removeFile(fileId)
  }

  const submitBatch = async () => {
    if (uploadFiles.length === 0 || isSubmitting) return

    setIsSubmitting(true)
    setUploadFiles(prev => prev.map(f => ({ ...f, status: 'uploading' })))

    const formData = new FormData()
    for (const item of uploadFiles) {
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
        throw new Error('Upload failed')
      }

      const result = await response.json()
      if (result.success && result.jobId) {
        navigate({ to: '/dashboard/processing-queue' })
      }
    } catch (err) {
      console.error('[UploadBatchCard] Submit failed:', err)
      setUploadFiles(prev => prev.map(f => ({ ...f, status: 'error', error: 'Upload failed' })))
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Upload Area matching c-file-upload-6 */}
      <div
        className={cn(
          "relative rounded-xl border border-dashed p-8 text-center transition-colors bg-card h-48 flex items-center justify-center cursor-pointer hover:border-primary/50",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input {...getInputProps()} className="sr-only" />

        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "bg-muted flex h-12 w-12 items-center justify-center rounded-full transition-colors",
              isDragging
                ? "border-primary bg-primary/10"
                : "border-border"
            )}
          >
            <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} className={cn("h-5 w-5", isDragging ? "text-primary" : "text-muted-foreground")} />
          </div>

          <div className="space-y-1 text-center">
            <h3 className="text-sm font-semibold text-foreground">
              Drop files here or browse files
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              Images up to 10MB ({MAX_FILES} max)
            </p>
          </div>
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <Alert variant="destructive" className="mt-2">
          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
          <AlertTitle>File upload error</AlertTitle>
          <AlertDescription>
            {errors.map((error, index) => (
              <p key={index} className="last:mb-0 text-xs">
                {error}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Files Table matching c-table-6 pattern inside a Frame */}
      {uploadFiles.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-semibold text-foreground">
              Selected Files ({uploadFiles.length})
            </h3>
            <div className="flex gap-2">
              <Button onClick={submitBatch} disabled={isSubmitting} variant="default" size="sm">
                <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={2} className="h-4 w-4 mr-1.5" />
                {isSubmitting ? "Uploading..." : "Start Batch"}
              </Button>
            </div>
          </div>

          <Frame spacing="xs" className="flex-1 overflow-hidden">
            <FramePanel className="p-0! overflow-auto bg-card">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="h-9 ps-4 font-semibold text-muted-foreground">File</TableHead>
                    <TableHead className="h-9 font-semibold text-muted-foreground">Size</TableHead>
                    <TableHead className="h-9 w-[60px] text-right pr-4 font-semibold text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadFiles.map((fileItem) => (
                    <TableRow key={fileItem.id} className="border-border/50">
                      <TableCell className="py-2 ps-4">
                        <div className="flex items-center gap-2">
                          <HugeiconsIcon icon={ImageIcon} strokeWidth={2} className="size-4 text-muted-foreground shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-sm font-medium text-foreground">
                              {fileItem.file.name}
                            </span>
                            {fileItem.status === "error" && (
                              <span className="text-xs text-destructive mt-0.5">Failed</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground py-2 text-xs">
                        {formatBytes(fileItem.file.size)}
                      </TableCell>
                      <TableCell className="py-2 text-right pr-4">
                        <Button
                          onClick={() => removeUploadFile(fileItem.id)}
                          variant="ghost"
                          size="icon"
                          disabled={isSubmitting}
                          className="size-7 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </FramePanel>
          </Frame>
        </div>
      )}
    </div>
  )
}
