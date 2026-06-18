import * as React from 'react'
import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  type SortingState,
  type ColumnDef,
  type PaginationState,
} from '@tanstack/react-table'

import { IMDB_COLUMNS, EXCEL_HEADERS, type ImdbColumnName } from '#/types/imdb.ts'
import { useRecordMutation } from '#/hooks/useRecordMutation.ts'
import { Spinner } from '#/components/spinner.tsx'
import {
  Eye,
  AlertCircle,
  Edit3,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'

import {
  Dialog,
  DialogContent,
} from '#/components/ui/dialog.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Badge } from '#/components/reui/badge.tsx'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '#/components/ui/avatar.tsx'

import {
  DataGrid,
  DataGridContainer,
} from '#/components/reui/data-grid/data-grid.tsx'
import { DataGridPagination } from '#/components/reui/data-grid/data-grid-pagination.tsx'
import { DataGridScrollArea } from '#/components/reui/data-grid/data-grid-scroll-area.tsx'
import { DataGridTable } from '#/components/reui/data-grid/data-grid-table.tsx'
import { DataGridColumnVisibility } from '#/components/reui/data-grid/data-grid-column-visibility.tsx'
import { RecordDetail } from '#/components/dashboard/RecordDetail.tsx'
import { useRecord } from '#/hooks/useRecord.ts'

interface ImdbTableProps {
  records: any[]
  orgId: string
  jobId: string
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
  const confidence = metadata?.confidence ?? record.confidence ?? 0
  const source = metadata?.source ?? 'AI Extraction Pipeline'

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

  const isConfidenceLow = confidence < 0.5
  const isConfidenceMedium = confidence >= 0.5 && confidence < 0.75

  if (isEditing) {
    return (
      <Input
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-8 px-1.5 py-0.5 text-xs bg-white dark:bg-neutral-900 border-indigo-500 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium text-neutral-900 dark:text-neutral-50"
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
          <Spinner size="sm" className="text-indigo-500" />
        ) : (
          <Edit3 className="size-3 text-neutral-400 hover:text-indigo-500 transition-colors" />
        )}
      </div>

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

// ─── Record Detail Dialog Component ──────────────────────────────────────────
function RecordDetailDialogContent({ recordId, orgId, jobId }: { recordId: string, orgId: string, jobId: string }) {
  const { data: recordData, isPending, error } = useRecord(orgId, recordId)
  
  if (isPending) {
    return (
      <div className="flex min-h-[400px] items-center justify-center flex-col gap-2">
        <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
        <p className="text-xs text-neutral-500 font-semibold animate-pulse">Loading audit evidence...</p>
      </div>
    )
  }

  if (error || !recordData?.record) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          Failed to load record details: {error?.message || 'Record not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden pt-4 pb-4 px-2">
      <RecordDetail record={recordData.record} orgId={orgId} jobId={recordData.record.jobId || jobId} />
    </div>
  )
}

// ─── Main Table Component ───────────────────────────────────────────────────
export function ImdbTable({ records, orgId, jobId }: ImdbTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })

  // Stable data reference — prevents new array identity on every parent render
  // which would cause the table to reset state on every re-render
  const data = useMemo(() => records, [records])
  
  // Define visibility for columns. We use useMemo to map exactly what should be visible by default.
  // We'll manage column visibility in table state, but rely on Tailwind for mobile hiding.
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      IMAGE: true,
      ITEM_NAME: true,
      BARCODE: true,
      BRAND: true,
      WEIGHT: true,
      confidence: true,
      actions: true,
    }
    IMDB_COLUMNS.forEach((col) => {
      if (initial[col] === undefined) {
        initial[col] = false
      }
    })
    return initial
  })

  // Construct image retrieval URL
  const getImageUrl = (fileName: string, recordJobId: string) => {
    const key = `${orgId}/${recordJobId}/${fileName}`
    return `/api/jobs/files?bucket=PRODUCT_IMAGES&key=${encodeURIComponent(key)}`
  }

  const tableColumns = useMemo<ColumnDef<any>[]>(() => {
    const cols: ColumnDef<any>[] = []


    // 2. IMAGE Collage
    cols.push({
      id: 'IMAGE',
      header: 'IMAGE',
      cell: ({ row }) => {
        const rawImages = row.original.rawExtraction?.images || []
        const images = rawImages.filter((v: any, i: number, a: any) => a.findIndex((t: any) => t.fileName === v.fileName) === i)
        const displayImages = images.slice(0, 3)
        const remainder = images.length - 3
        const recordJobId = row.original.jobId || jobId

        return (
          <div className="flex items-center -space-x-2">
            {displayImages.map((img: any, i: number) => (
              <Avatar key={i} className="size-8 border-2 border-background shadow-xs">
                <AvatarImage src={getImageUrl(img.fileName, recordJobId)} className="object-cover" />
                <AvatarFallback className="text-[10px] bg-neutral-100 dark:bg-neutral-800">Img</AvatarFallback>
              </Avatar>
            ))}
            {remainder > 0 && (
              <Avatar className="size-8 border-2 border-background shadow-xs">
                <AvatarFallback className="text-[10px] font-bold bg-neutral-200 dark:bg-neutral-700">+{remainder}</AvatarFallback>
              </Avatar>
            )}
            {images.length === 0 && (
              <Avatar className="size-8 border-2 border-background shadow-xs">
                <AvatarFallback className="text-[10px] bg-neutral-100 dark:bg-neutral-800">-</AvatarFallback>
              </Avatar>
            )}
          </div>
        )
      },
      size: 120,
      enableSorting: false,
    })

    // 3. Dynamic 13 IMDB Columns
    IMDB_COLUMNS.forEach((colName) => {
      // For mobile responsiveness: hide non-critical columns on 'sm' and down
      const isCritical = colName === 'ITEM_NAME'
      
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
              jobId={row.original.jobId || jobId}
            />
          )
        },
        size: colName === 'ITEM_NAME' ? 250 : 150,
        enableSorting: true,
        meta: {
          headerClassName: !isCritical ? "hidden md:table-cell" : "",
          cellClassName: !isCritical ? "hidden md:table-cell" : "",
        }
      })
    })

    // 4. Overall Confidence Column
    cols.push({
      id: 'confidence',
      header: 'CONFIDENCE',
      accessorKey: 'confidence',
      cell: ({ getValue }: any) => {
        const val = getValue() as number
        const pct = (val * 100).toFixed(0)
        
        let variant: "success-light" | "warning-light" | "destructive-light" = "success-light"
        let barColor = "bg-emerald-500"
        
        if (val < 0.5) {
          variant = "destructive-light"
          barColor = "bg-rose-500"
        } else if (val < 0.75) {
          variant = "warning-light"
          barColor = "bg-amber-500"
        }

        return (
          <div className="flex flex-col gap-1 w-24">
            <Badge variant={variant} size="xs" className="w-fit">{pct}%</Badge>
            <div className="w-full h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden mt-1">
              <div
                style={{ width: `${val * 100}%` }}
                className={cn('h-full rounded-full', barColor)}
              />
            </div>
          </div>
        )
      },
      size: 120,
      enableSorting: true,
    })

    // 5. Actions Column
    cols.push({
      id: 'actions',
      header: 'ACTIONS',
      cell: ({ row }: any) => (
        <div className="flex items-center justify-end pr-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            onClick={() => setSelectedRecordId(row.original.id)}
            title="View full evidence audit details"
          >
            <Eye className="size-4" />
          </Button>
        </div>
      ),
      size: 80,
      enableSorting: false,
    })

    return cols
  }, [orgId, jobId])


  const table = useReactTable({
    columns: tableColumns,
    data,
    getRowId: (row: any) => row.id,
    // Let TanStack handle page resets automatically when filters or data change.
    autoResetPageIndex: true,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Search and Column Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search records..."
            className="w-full h-10 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800/80 rounded-xl"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <DataGridColumnVisibility
            table={table}
            trigger={
              <Button variant="outline" className="h-10 rounded-xl shadow-xs">
                Columns
              </Button>
            }
          />
        </div>
      </div>

      <DataGrid
        table={table}
        recordCount={table.getFilteredRowModel().rows.length}
        tableLayout={{
          width: "auto",
        }}
      >
        <div className="w-full space-y-2.5">
          <DataGridContainer>
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
          </DataGridContainer>
          <DataGridPagination />
        </div>
      </DataGrid>

      {/* Record Detail Dialog */}
      <Dialog open={!!selectedRecordId} onOpenChange={(open) => !open && setSelectedRecordId(null)}>
        <DialogContent
          className={cn(
            "max-w-[95vw] sm:max-w-5xl p-0 overflow-hidden bg-white dark:bg-neutral-950",
            "[&>[data-slot=dialog-close]]:bg-background [&>[data-slot=dialog-close]]:-end-6 [&>[data-slot=dialog-close]]:-top-6",
            "[&>[data-slot=dialog-close]]:size-7 [&>[data-slot=dialog-close]]:rounded-full [&>[data-slot=dialog-close]]:border [&>[data-slot=dialog-close]]:shadow-sm"
          )}
        >
          {selectedRecordId && (
            <RecordDetailDialogContent 
              recordId={selectedRecordId} 
              orgId={orgId} 
              jobId={jobId} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
