import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { UploadForm } from '#/components/dashboard/UploadForm.tsx'

export const Route = createFileRoute('/dashboard/uploads')({
  head: () => ({
    meta: [
      { title: 'Upload Batch - ShelfMind' },
      { name: 'description', content: 'Submit product images to the ShelfMind ingestion queue.' }
    ]
  }),
  component: UploadsPage,
})

function UploadsPage() {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50 font-heading">
          Batch Image Ingestion
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
          Upload up to 20 product packaging images. The hybrid AI extraction pipeline scans barcodes and reads product details in parallel.
        </p>
      </div>

      {/* Upload Form Component */}
      <div className="mt-2">
        <UploadForm />
      </div>
    </div>
  )
}
