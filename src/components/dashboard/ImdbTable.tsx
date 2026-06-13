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
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'

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

// ─── Main Table Component ───────────────────────────────────────────────────
export function ImdbTable({ records, orgId, jobId }: ImdbTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
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
                    className="border-b border-neutral-100 dark:border-neutral-800/20 hover:bg-white/50 dark:hover:bg-neutral-900/30 transition-colors last:border-0"
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
    </div>
  )
}
