"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Camera01Icon, CameraVideoIcon, Cancel01Icon, RefreshIcon, BarCode01Icon, CheckmarkCircle02Icon, AlertCircleIcon } from '@hugeicons/core-free-icons'
import { Button } from '#/components/ui/button.tsx'
import { Spinner } from '#/components/spinner.tsx'
import { cn } from '#/lib/utils.ts'
import { decodeBarcodeFromImage } from '#/lib/zxing.ts'
import { calculateBlurScore } from '#/lib/blur.ts'

type CaptureStep = 'front' | 'back' | 'side' | 'done'

interface CameraCaptureProps {
  /** Called with the captured batch of images (front, back, side). */
  onCapture: (files: File[]) => void
  /** Disables capture (e.g. while a batch is uploading). */
  disabled?: boolean
}

interface LiveBarcode {
  text: string
  format: string
  valid: boolean
}

// How often the live scanner samples a video frame for a barcode (ms).
const SCAN_INTERVAL_MS = 700
const BLUR_THRESHOLD = 100 // Laplacian variance threshold

/**
 * In-browser camera capture for the upload flow. Opens the device camera via
 * getUserMedia, lets the user snap stills that feed the same extraction
 * pipeline as file uploads, and runs a live client-side ZXing scan so an
 * on-screen barcode is decoded and check-digit validated before capture.
 */
export function CameraCapture({ onCapture, disabled }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)

  const [isActive, setIsActive] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capturedCount, setCapturedCount] = useState(0)
  const [liveBarcode, setLiveBarcode] = useState<LiveBarcode | null>(null)
  const [captureStep, setCaptureStep] = useState<CaptureStep>('front')
  const [, setCapturedFiles] = useState<File[]>([])
  const [isBlurry, setIsBlurry] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setIsActive(false)
    setLiveBarcode(null)
    setIsBlurry(false)
    setCaptureStep('front')
    setCapturedFiles([])
  }, [])

  // Grabs the current video frame to the offscreen canvas and returns it.
  const drawFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return null
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas
  }, [])

  // Continuously samples frames and decodes any visible barcode (best-effort).
  const runScanLoop = useCallback(async () => {
    if (scanningRef.current) return
    scanningRef.current = true
    while (scanningRef.current) {
      const canvas = drawFrame()
      if (canvas) {
        try {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const blurScore = calculateBlurScore(imageData)
            if (scanningRef.current) {
              setIsBlurry(blurScore < BLUR_THRESHOLD)
            }
          }

          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.7),
          )
          if (blob) {
            const buffer = await blob.arrayBuffer()
            const result = await decodeBarcodeFromImage(buffer)
            if (scanningRef.current) {
              setLiveBarcode(
                result
                  ? { text: result.text, format: result.format, valid: result.valid }
                  : null,
              )
            }
          }
        } catch {
          // Best-effort scan; ignore decode failures.
        }
      }
      await new Promise((r) => setTimeout(r, SCAN_INTERVAL_MS))
    }
  }, [drawFrame])

  const startCamera = useCallback(async () => {
    setError(null)
    setIsStarting(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setIsActive(true)
      void runScanLoop()
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      setError(
        name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access and try again.'
          : name === 'NotFoundError'
            ? 'No camera device was found.'
            : err instanceof Error
              ? err.message
              : 'Could not start the camera.',
      )
    } finally {
      setIsStarting(false)
    }
  }, [runScanLoop])

  const capture = useCallback(() => {
    if (disabled || isBlurry || captureStep === 'done' || isCapturing) return
    setIsCapturing(true)
    const canvas = drawFrame()
    if (!canvas) {
      setIsCapturing(false)
      return
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setIsCapturing(false)
          return
        }
        const file = new File([blob], `camera-${captureStep}-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })

        setCapturedFiles(prev => {
          const newFiles = [...prev, file]
          setCapturedCount(newFiles.length)

          if (captureStep === 'front') {
            setCaptureStep('back')
            setIsCapturing(false)
          } else if (captureStep === 'back') {
            setCaptureStep('side')
            setIsCapturing(false)
          } else if (captureStep === 'side') {
            setCaptureStep('done')
            onCapture(newFiles)
            stopCamera()
            setIsCapturing(false)
          }

          return newFiles
        })
      },
      'image/jpeg',
      0.9,
    )
  }, [disabled, isBlurry, captureStep, isCapturing, drawFrame, onCapture, stopCamera])

  // Tear down the stream on unmount.
  useEffect(() => stopCamera, [stopCamera])

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 flex flex-col gap-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/90">
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            'h-full w-full object-cover',
            isActive ? 'opacity-100' : 'opacity-0',
          )}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
              <HugeiconsIcon icon={CameraVideoIcon} className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground font-medium max-w-xs">
              Use your device camera to photograph products. Live barcode scanning runs while the camera is on.
            </p>
            <Button
              type="button"
              onClick={startCamera}
              disabled={isStarting || disabled}
              className="h-9 px-4 rounded-lg font-semibold"
            >
              {isStarting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Starting camera…
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={CameraVideoIcon} className="size-4 mr-2" />
                  Start Camera
                </>
              )}
            </Button>
          </div>
        )}

        {/* Live barcode overlay */}
        {isActive && liveBarcode && (
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 rounded-lg bg-black/70 px-3 py-2 backdrop-blur-sm z-10">
            <span className="flex items-center gap-2 text-xs font-semibold text-white">
              <HugeiconsIcon icon={BarCode01Icon} className="size-4" />
              {liveBarcode.text}
              <span className="text-[10px] text-white/60 font-medium">({liveBarcode.format})</span>
            </span>
            <span
              className={cn(
                'flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md',
                liveBarcode.valid
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-destructive/20 text-destructive',
              )}
            >
              <HugeiconsIcon
                icon={liveBarcode.valid ? CheckmarkCircle02Icon : AlertCircleIcon}
                className="size-3"
              />
              {liveBarcode.valid ? 'Valid' : 'Invalid'}
            </span>
          </div>
        )}

        {/* Blur overlay */}
        {isActive && isBlurry && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
            <div className="bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-5" />
              Image too blurry
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5" />
          {error}
        </p>
      )}

      {isActive && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground font-medium">
            {captureStep === 'done' 
              ? 'Batch captured' 
              : `Capture ${captureStep.charAt(0).toUpperCase() + captureStep.slice(1)} of item`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={stopCamera}
              className="h-9 px-3 rounded-lg"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4 mr-1.5" />
              Stop
            </Button>
            <Button
              type="button"
              onClick={capture}
              disabled={disabled || isBlurry || captureStep === 'done' || isCapturing}
              className="h-9 px-4 rounded-lg font-semibold"
            >
              <HugeiconsIcon icon={Camera01Icon} className="size-4 mr-1.5" />
              Capture
            </Button>
          </div>
        </div>
      )}

      {!isActive && capturedCount > 0 && (
        <button
          type="button"
          onClick={startCamera}
          disabled={disabled}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline underline-offset-4"
        >
          <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
          Resume camera
        </button>
      )}
    </div>
  )
}
