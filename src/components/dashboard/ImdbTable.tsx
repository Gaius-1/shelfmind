import * as React from 'react'
import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table'
import { IMDB_COLUMNS, EXCEL_HEADERS, type ImdbColumnName } from '#/types/imdb.ts'
import { useRecordMutation } from '#/hooks/useRecordMutation.ts'
import { Spinner } from '#/components/spinner.tsx'
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Edit3,
  AlertCircle,
  Check,
  Eye,
  Info,
  Save,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  FileText,
  Barcode as BarcodeIcon,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import {
  Dialog,
  DialogContent,
} from '#/components/ui/dialog.tsx'
import {
  Frame,
  FramePanel,
  FrameHeader,
  FrameTitle,
} from '#/components/reui/frame.tsx'

interface ImdbTableProps {
  records: any[]
  orgId: string
  jobId: string // Used for cache invalidation
  showJobFilter?: boolean
}

// ─── Editable Cell Component ────────────────────────────────────────────────
interface EditableCellProps {
  record: any
  columnName: ImdbColumnName
  value: string
  orgId: string
  jobId: string
}

function EditableCell({ record, columnName, value, orgId, jobId }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value || '')
  
  const mutation = useRecordMutation({ orgId, jobId, recordId: record.id })
  
  const metadata = record.fieldMetadata?.[columnName]
  const confidence = metadata?.confidence ?? 0
  const source = metadata?.source ?? 'Merged'

  const handleDoubleClick = () => {
    setTempValue(value || '')
    setIsEditing(true)
  }

  const handleBlur = () => {
    setIsEditing(false)
    if (tempValue !== (value || '')) {
      mutation.mutate({
        fields: {
          [columnName]: tempValue,
        },
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  // Determine styling based on confidence
  const isConfidenceLow = confidence < 0.5
  const isConfidenceMedium = confidence >= 0.5 && confidence < 0.75

  if (isEditing) {
    return (
      <input
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-8 px-1.5 py-0.5 text-xs bg-white dark:bg-neutral-900 border border-indigo-500 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium text-neutral-900 dark:text-neutral-50"
        autoFocus
      />
    )
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className="group relative flex items-center justify-between min-h-8 cursor-pointer rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800/40 px-1.5 py-0.5 transition-colors"
      title={`Source: ${source} | Confidence: ${(confidence * 100).toFixed(0)}%`}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {/* Color-coded confidence dot */}
        <span
          className={cn(
            "size-1.5 rounded-full shrink-0",
            isConfidenceLow && "bg-rose-500 shadow-rose-500/20 shadow-xs",
            isConfidenceMedium && "bg-amber-400 shadow-amber-400/20 shadow-xs",
            !isConfidenceLow && !isConfidenceMedium && "bg-emerald-400 shadow-emerald-400/20 shadow-xs"
          )}
        />
        <span
          className={cn(
            "truncate text-xs font-medium",
            isConfidenceLow && "text-rose-600 dark:text-rose-400 font-semibold",
            isConfidenceMedium && "text-amber-600 dark:text-amber-400",
            !value && "text-neutral-300 dark:text-neutral-600 italic"
          )}
        >
          {value || 'Empty'}
        </span>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
        {mutation.isPending ? (
          <Spinner size="xs" className="text-indigo-500" />
        ) : (
          <Edit3 className="size-3 text-neutral-400 hover:text-indigo-500 transition-colors" />
        )}
      </div>

      {/* Floating badge for metadata on cell hover */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-200 z-30 bg-neutral-900/95 dark:bg-neutral-950/95 text-white px-2 py-1 rounded-lg text-[9px] shadow-xl flex items-center gap-1.5 whitespace-nowrap">
        <span className="font-semibold">{source}</span>
        <span className="h-2 w-px bg-neutral-700" />
        <span className={cn(
          "font-bold",
          isConfidenceLow && "text-rose-400",
          isConfidenceMedium && "text-amber-400",
          !isConfidenceLow && !isConfidenceMedium && "text-emerald-400"
        )}>
          {(confidence * 100).toFixed(0)}% confidence
        </span>
      </div>
    </div>
  )
}

// ─── Record Detail Modal Component ──────────────────────────────────────────
interface RecordDetailModalProps {
  record: any
  orgId: string
  jobId: string
  onClose: () => void
}

function RecordDetailModal({ record, orgId, jobId, onClose }: RecordDetailModalProps) {
  // Local form state for the 13 fields
  const [formFields, setFormFields] = useState<Record<string, string>>(() => {
    const fields: Record<string, string> = {}
    IMDB_COLUMNS.forEach((col) => {
      fields[col] = record[col] || ''
    })
    return fields
  })

  // Watch for record changes
  React.useEffect(() => {
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
      console.error('[RecordDetailModal] Save failed:', err)
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

  return (
    <div className="flex flex-col gap-5 w-full text-neutral-900 dark:text-neutral-50">
      {/* Header Bar inside Dialog */}
      <div className="flex flex-col gap-1.5 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold truncate max-w-[80%] text-neutral-900 dark:text-neutral-50">
            {record.ITEM_NAME || 'Unnamed Product'}
          </h2>
          {record.flagged && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/40 dark:border-amber-900/30 text-[10px] font-bold shadow-xs">
              <AlertTriangle className="size-3.5 shrink-0" />
              Review Required
            </span>
          )}
        </div>
        <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
          ID: {record.id.substring(0, 8)} • Group: {record.productGroupKey || 'None'} • Quality: {(record.confidence * 100).toFixed(0)}%
        </p>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Image Gallery & Extraction Evidence */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <Frame spacing="sm">
            <FrameHeader>
              <FrameTitle className="text-xs uppercase tracking-wider text-neutral-400">Source Images ({images.length})</FrameTitle>
            </FrameHeader>

            <FramePanel className="flex flex-col gap-3">
              {images.length > 0 ? (
                <>
                  <div className="relative aspect-square w-full rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden flex items-center justify-center shadow-inner">
                    <img
                      src={getImageUrl(currentImage.fileName)}
                      alt="Source Product Image"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  {/* Thumbnail Selector */}
                  {images.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {images.map((img: any, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImageIndex(idx)}
                          className={cn(
                            "px-2 py-1 text-[10px] font-bold rounded-lg border transition-all shrink-0",
                            idx === activeImageIndex
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          )}
                        >
                          {img.fileName.split('_').pop() || `Img ${idx + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="aspect-square w-full rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-xs font-semibold text-neutral-400">
                  No images available
                </div>
              )}
            </FramePanel>
          </Frame>

          {/* Evidence panel */}
          <Frame spacing="xs">
            <FrameHeader>
              <FrameTitle className="text-xs uppercase tracking-wider text-neutral-400">Extraction Evidence</FrameTitle>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              <div className="flex p-0.5 bg-neutral-100 dark:bg-neutral-900 rounded-lg">
                <button
                  type="button"
                  onClick={() => setEvidenceTab('vision')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold rounded-md transition-all",
                    evidenceTab === 'vision'
                      ? "bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  <Sparkles className="size-3" />
                  Structured
                </button>
                <button
                  type="button"
                  onClick={() => setEvidenceTab('ocr')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold rounded-md transition-all",
                    evidenceTab === 'ocr'
                      ? "bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  <FileText className="size-3" />
                  OCR
                </button>
                <button
                  type="button"
                  onClick={() => setEvidenceTab('zxing')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold rounded-md transition-all",
                    evidenceTab === 'zxing'
                      ? "bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  <BarcodeIcon className="size-3" />
                  ZXing
                </button>
              </div>

              <div className="bg-neutral-900 text-neutral-100 rounded-lg p-2.5 text-[10px] font-mono max-h-[140px] overflow-y-auto border border-neutral-800 shadow-inner">
                {evidenceTab === 'vision' && (
                  <pre className="whitespace-pre-wrap leading-relaxed">
                    {currentImage?.vision
                      ? JSON.stringify(currentImage.vision, null, 2)
                      : '// No VLM structured extraction available'}
                  </pre>
                )}
                {evidenceTab === 'ocr' && (
                  <pre className="whitespace-pre-wrap leading-relaxed">
                    {currentImage?.ocr || '// No OCR text available'}
                  </pre>
                )}
                {evidenceTab === 'zxing' && (
                  <div className="flex flex-col gap-1 py-0.5 font-semibold text-neutral-300">
                    <p>WASM Barcode Scanner (ZXing):</p>
                    <p className="text-white text-xs mt-1">
                      Detected: {currentImage?.zxing?.barcode ? (
                        <span className="text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/30">
                          {currentImage.zxing.barcode}
                        </span>
                      ) : (
                        <span className="text-neutral-500 italic">None</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </FramePanel>
          </Frame>
        </div>

        {/* Right Column: Editable fields */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <Frame spacing="sm">
              <FrameHeader>
                <FrameTitle className="text-xs uppercase tracking-wider text-neutral-400">Master Data Columns</FrameTitle>
              </FrameHeader>
              <FramePanel className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
                {IMDB_COLUMNS.map((colName) => {
                  const metadata = record.fieldMetadata?.[colName]
                  const confidence = metadata?.confidence ?? 0
                  const source = metadata?.source ?? 'Merged'

                  return (
                    <div
                      key={colName}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center border-b border-neutral-100 dark:border-neutral-900 pb-2.5 last:border-0 last:pb-0"
                    >
                      <div className="sm:col-span-4 flex flex-col gap-0.5">
                        <label className="text-[10px] font-extrabold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider">
                          {EXCEL_HEADERS[colName]}
                        </label>
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1 py-0.2 rounded">
                            {source}
                          </span>
                          <span className={cn(
                            "text-[8px] font-extrabold px-1 py-0.2 rounded border",
                            getConfidenceColorClass(confidence)
                          )}>
                            {(confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="sm:col-span-8">
                        <input
                          type="text"
                          value={formFields[colName]}
                          onChange={(e) => handleFieldChange(colName, e.target.value)}
                          className={cn(
                            "w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-900 border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-neutral-900 dark:text-neutral-50",
                            confidence < 0.5 && !mutation.isPending && "border-rose-200 dark:border-rose-900/40 bg-rose-50/10",
                            confidence >= 0.5 && confidence < 0.75 && !mutation.isPending && "border-amber-200 dark:border-amber-900/40 bg-amber-50/10",
                            confidence >= 0.75 && !mutation.isPending && "border-neutral-200 dark:border-neutral-800"
                          )}
                          placeholder={`Enter ${EXCEL_HEADERS[colName].toLowerCase()}...`}
                        />
                      </div>
                    </div>
                  )
                })}
              </FramePanel>
            </Frame>

            {/* Actions Footer */}
            <div className="flex items-center justify-between gap-4 p-3 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-950/20 rounded-2xl">
              <div className="flex items-center gap-2">
                {saveSuccess && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade-in">
                    <CheckCircle className="size-4 shrink-0" />
                    Changes saved successfully
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 px-3.5 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 rounded-xl transition-colors border border-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="flex items-center gap-1.5 h-8 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 transition-colors shadow-xs"
                >
                  {mutation.isPending ? (
                    <Spinner size="xs" className="text-white" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Main Table Component ───────────────────────────────────────────────────
export function ImdbTable({ records, orgId, jobId }: ImdbTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    // Show important columns by default, hide less critical ones
    const initial: Record<string, boolean> = {
      ITEM_NAME: true,
      BARCODE: true,
      BRAND: true,
      MANUFACTURER: true,
      WEIGHT: true,
      PACKAGING_TYPE: true,
      COUNTRY: true,
      confidence: true,
      actions: true,
    }
    // Others default to false (can be toggled)
    IMDB_COLUMNS.forEach((col) => {
      if (initial[col] === undefined) {
        initial[col] = false
      }
    })
    return initial
  })
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false)

  // Define table columns
  const tableColumns = useMemo(() => {
    const cols: any[] = []

    // 1. Flagged Status Column
    cols.push({
      id: 'flagged',
      header: '',
      accessorKey: 'flagged',
      cell: ({ row }: any) => {
        if (row.original.flagged) {
          return (
            <div className="flex items-center justify-center" title="Requires review">
              <AlertCircle className="size-4 text-amber-500 fill-amber-500/10 shrink-0" />
            </div>
          )
        }
        return (
          <div className="flex items-center justify-center">
            <Check className="size-3.5 text-emerald-500 shrink-0" />
          </div>
        )
      },
      enableSorting: true,
    })

    // 2. Dynamic 13 IMDB Columns
    IMDB_COLUMNS.forEach((colName) => {
      cols.push({
        id: colName,
        header: EXCEL_HEADERS[colName],
        accessorKey: colName,
        cell: ({ row, getValue }: any) => {
          return (
            <EditableCell
              record={row.original}
              columnName={colName}
              value={getValue() as string}
              orgId={orgId}
              jobId={jobId}
            />
          )
        },
        enableSorting: true,
      })
    })

    // 3. Overall Confidence Column
    cols.push({
      id: 'confidence',
      header: 'CONFIDENCE',
      accessorKey: 'confidence',
      cell: ({ getValue }: any) => {
        const val = getValue() as number
        const pct = (val * 100).toFixed(0)
        return (
          <div className="flex flex-col gap-1 w-20">
            <div className="flex justify-between text-[10px] font-bold">
              <span
                className={cn(
                  val >= 0.85
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : val >= 0.75
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : val >= 0.5
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {pct}%
              </span>
            </div>
            <div className="w-full h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${val * 100}%` }}
                className={cn(
                  'h-full rounded-full',
                  val >= 0.85 && 'bg-emerald-500',
                  val >= 0.75 && 'bg-indigo-500',
                  val >= 0.5 && 'bg-amber-500',
                  val < 0.5 && 'bg-rose-500'
                )}
              />
            </div>
          </div>
        )
      },
      enableSorting: true,
    })

    // 4. Actions Column
    cols.push({
      id: 'actions',
      header: 'ACTIONS',
      cell: ({ row }: any) => (
        <div className="flex items-center justify-end">
          <Link
            to={`/dashboard/review-queue/${row.original.id}`}
            className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            title="View full evidence audit details"
          >
            <Eye className="size-4" />
          </Link>
        </div>
      ),
    })

    return cols
  }, [orgId, jobId])

  // Filter columns based on visibleColumns state
  const activeColumns = useMemo(() => {
    return tableColumns.filter((col) => {
      if (col.id === 'flagged' || col.id === 'actions') return true
      return visibleColumns[col.id]
    })
  }, [tableColumns, visibleColumns])

  const table = useReactTable({
    data: records,
    columns: activeColumns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Search and Column Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        {/* Global Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search records..."
            className="w-full h-10 pl-9 pr-4 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium placeholder-neutral-400 transition-all shadow-xs"
          />
        </div>

        {/* Columns Dropdown Toggle */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsColumnDropdownOpen((v) => !v)}
            className="flex items-center gap-2 h-10 px-4 text-xs font-bold bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors shadow-xs"
          >
            <SlidersHorizontal className="size-4 text-neutral-400" />
            Columns
            <ChevronDown className={cn("size-3 text-neutral-400 transition-transform", isColumnDropdownOpen && "rotate-180")} />
          </button>

          {isColumnDropdownOpen && (
            <>
              {/* Overlay to close */}
              <div className="fixed inset-0 z-40" onClick={() => setIsColumnDropdownOpen(false)} />
              
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-3 flex flex-col gap-2 max-h-[360px] overflow-y-auto animate-in fade-in-0 duration-100">
                <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-1">Toggle Columns</p>
                <div className="flex flex-col gap-1">
                  {IMDB_COLUMNS.map((col) => (
                    <label
                      key={col}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 cursor-pointer text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                    >
                      <input
                        type="checkbox"
                        checked={!!visibleColumns[col]}
                        onChange={(e) => {
                          setVisibleColumns((prev) => ({
                            ...prev,
                            [col]: e.target.checked,
                          }))
                        }}
                        className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {EXCEL_HEADERS[col]}
                    </label>
                  ))}
                  <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1" />
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 cursor-pointer text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    <input
                      type="checkbox"
                      checked={!!visibleColumns.confidence}
                      onChange={(e) => {
                        setVisibleColumns((prev) => ({
                          ...prev,
                          confidence: e.target.checked,
                        }))
                      }}
                      className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    CONFIDENCE SCORE
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table Area */}
      <div className="w-full border border-neutral-200 dark:border-neutral-800/80 rounded-2xl bg-white/40 dark:bg-neutral-900/10 backdrop-blur-xl overflow-hidden shadow-xs">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-neutral-200 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-900/40"
                >
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort()
                    const sortDir = header.column.getIsSorted()

                    return (
                      <th
                        key={header.id}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        className={cn(
                          "px-4 py-3 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest select-none",
                          canSort && "cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-300"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && sortDir === 'asc' && <ChevronUp className="size-3 shrink-0" />}
                          {canSort && sortDir === 'desc' && <ChevronDown className="size-3 shrink-0" />}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeColumns.length + 1}
                    className="px-4 py-12 text-center text-xs font-semibold text-neutral-400 dark:text-neutral-500"
                  >
                    No records found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-neutral-100 dark:border-neutral-800/20 hover:bg-white/50 dark:hover:bg-neutral-900/30 transition-colors last:border-0 cursor-pointer"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (
                        target.closest('input') ||
                        target.closest('button') ||
                        target.closest('a') ||
                        target.closest('svg') ||
                        target.closest('span.size-1.5') ||
                        target.closest('.pointer-events-none')
                      ) {
                        return;
                      }
                      setSelectedRecord(row.original);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2 border-neutral-100 dark:border-neutral-800/20">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {table.getPageCount() > 1 && (
          <div className="px-4 py-3.5 border-t border-neutral-200/50 dark:border-neutral-800/40 bg-neutral-50/20 dark:bg-neutral-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Showing page <span className="font-bold text-neutral-800 dark:text-neutral-200">{table.getState().pagination.pageIndex + 1}</span> of{' '}
              <span className="font-bold text-neutral-800 dark:text-neutral-200">{table.getPageCount()}</span> ({records.length} records)
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 text-neutral-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
              >
                <ChevronsLeft className="size-3.5" />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 text-neutral-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 text-neutral-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
              >
                <ChevronRight className="size-3.5" />
              </button>
              <button
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 text-neutral-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
              >
                <ChevronsRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedRecord && (
        <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
          <DialogContent className="sm:max-w-2xl md:max-w-4xl lg:max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 bg-card dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl">
            <RecordDetailModal
              record={selectedRecord}
              orgId={orgId}
              jobId={jobId}
              onClose={() => setSelectedRecord(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
