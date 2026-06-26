import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '#/components/ui/card.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useDuplicateAction } from '#/hooks/useDuplicateAction.ts'
import { Spinner } from '#/components/spinner.tsx'
import { AlertCircle, CheckCircle, XCircle, Barcode, Scale, Building, Tag, Layers } from 'lucide-react'
import { cn } from '#/lib/utils.ts'

export interface DuplicatePair {
  id: string
  similarityScore: number
  reason: 'BARCODE_MATCH' | 'NAME_MATCH' | 'BRAND_WEIGHT_MATCH' | 'CROSS_BATCH_MATCH' | string | null
  status: 'PENDING' | 'DISMISSED' | 'MERGED'
  recordA: any
  recordB: any
}

interface DuplicateCardProps {
  pair: DuplicatePair
  orgId: string
}

export function DuplicateCard({ pair, orgId }: DuplicateCardProps) {
  const mutation = useDuplicateAction(orgId)

  const recordA = pair.recordA
  const recordB = pair.recordB

  const handleAction = async (action: 'DISMISS' | 'MERGE') => {
    try {
      await mutation.mutateAsync({ pairId: pair.id, action })
    } catch (err) {
      console.error(`[DuplicateCard] Failed to ${action.toLowerCase()} pair:`, err)
    }
  }

  if (!recordA || !recordB) {
    return (
      <Card className="border border-rose-100 dark:border-rose-950/20 bg-rose-50/10 dark:bg-rose-950/5 rounded-2xl">
        <CardContent className="p-4 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-semibold">
          <AlertCircle className="size-4 shrink-0" />
          Error: Duplicate pair contains missing or corrupt record references.
        </CardContent>
      </Card>
    )
  }

  // Key fields to compare side-by-side
  const fieldsToCompare = [
    { label: 'Item Name', key: 'ITEM_NAME', icon: Tag },
    { label: 'Barcode', key: 'BARCODE', icon: Barcode },
    { label: 'Brand', key: 'BRAND', icon: Tag },
    { label: 'Weight/Volume', key: 'WEIGHT', icon: Scale },
    { label: 'Manufacturer', key: 'MANUFACTURER', icon: Building },
    { label: 'Packaging Type', key: 'PACKAGING_TYPE', icon: Layers },
  ]

  const getReasonLabel = (reason: string | null) => {
    if (reason === 'BARCODE_MATCH') return 'Exact Barcode Match'
    if (reason === 'NAME_MATCH') return 'Item Name Similarity'
    if (reason === 'BRAND_WEIGHT_MATCH') return 'Brand & Weight Similarity'
    if (reason === 'CROSS_BATCH_MATCH') return 'Cross-Batch Match (Watermark/Barcode)'
    return reason || 'Candidate Match'
  }

  return (
    <Card className="border border-neutral-200 dark:border-neutral-800/80 bg-white/40 dark:bg-neutral-900/10 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xs hover:border-neutral-300 dark:hover:border-neutral-800 transition-all duration-200">
      {/* Header Info */}
      <CardHeader className="p-5 border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50/30 dark:bg-neutral-900/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Duplicate Candidate
          </CardTitle>
          <CardDescription className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
            Reason: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{getReasonLabel(pair.reason)}</span>
          </CardDescription>
        </div>

        {/* Similarity Score Badge */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-extrabold px-3 py-1 rounded-xl border shadow-xs",
              pair.similarityScore >= 0.90
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/40 dark:border-emerald-900/30"
                : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200/40 dark:border-indigo-900/30"
            )}
          >
            {(pair.similarityScore * 100).toFixed(0)}% Similarity
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-5 flex flex-col gap-5">
        {/* Comparative Side-by-Side Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Record A (Surviving Master) */}
          <div className="flex flex-col gap-3 p-4 rounded-2xl bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/30 dark:border-indigo-900/10">
            <h3 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider border-b border-indigo-100/40 dark:border-indigo-900/20 pb-2">
              Record A (Surviving Master)
            </h3>
            
            <div className="flex flex-col gap-2.5">
              {fieldsToCompare.map(({ label, key, icon: Icon }) => {
                const valA = recordA[key] || ''
                const valB = recordB[key] || ''
                const hasMismatch = valA.trim().toLowerCase() !== valB.trim().toLowerCase()

                return (
                  <div key={key} className="flex flex-col gap-0.5 text-xs">
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wide flex items-center gap-1">
                      <Icon className="size-3 text-neutral-400 shrink-0" />
                      {label}
                    </span>
                    <p className={cn(
                      "font-semibold text-neutral-800 dark:text-neutral-200 truncate",
                      hasMismatch && valA && "text-indigo-700 dark:text-indigo-300 font-bold"
                    )}>
                      {valA || <span className="text-neutral-300 dark:text-neutral-700 italic">Empty</span>}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Record B (Duplicate SKU to Merge) */}
          <div className="flex flex-col gap-3 p-4 rounded-2xl bg-neutral-50/40 dark:bg-neutral-900/30 border border-neutral-200/30 dark:border-neutral-800/30 animate-in fade-in-0 duration-200">
            <h3 className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-200/40 dark:border-neutral-800/20 pb-2">
              Record B (Duplicate SKU to Merge)
            </h3>

            <div className="flex flex-col gap-2.5">
              {fieldsToCompare.map(({ label, key, icon: Icon }) => {
                const valA = recordA[key] || ''
                const valB = recordB[key] || ''
                const hasMismatch = valA.trim().toLowerCase() !== valB.trim().toLowerCase()

                return (
                  <div key={key} className="flex flex-col gap-0.5 text-xs">
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wide flex items-center gap-1">
                      <Icon className="size-3 text-neutral-400 shrink-0" />
                      {label}
                    </span>
                    <p className={cn(
                      "font-semibold text-neutral-800 dark:text-neutral-200 truncate px-1 rounded-sm",
                      hasMismatch && valB && "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20 font-bold border border-dashed border-amber-200/40 dark:border-amber-900/20"
                    )}>
                      {valB || <span className="text-neutral-300 dark:text-neutral-700 italic">Empty</span>}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end items-center gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-900">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAction('DISMISS')}
            disabled={mutation.isPending}
            className="text-xs font-bold text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 h-9 rounded-xl border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 px-4"
          >
            {mutation.isPending && mutation.variables?.action === 'DISMISS' ? (
              <Spinner size="sm" className="mr-1.5 text-neutral-500" />
            ) : (
              <XCircle className="size-4 mr-1.5" />
            )}
            Dismiss (False Positive)
          </Button>

          <Button
            size="sm"
            onClick={() => handleAction('MERGE')}
            disabled={mutation.isPending}
            className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 h-9 rounded-xl px-4 flex items-center gap-1.5 shadow-lg shadow-indigo-600/10 dark:shadow-indigo-500/10"
          >
            {mutation.isPending && mutation.variables?.action === 'MERGE' ? (
              <Spinner size="sm" className="mr-1.5 text-white" />
            ) : (
              <CheckCircle className="size-4 mr-1.5" />
            )}
            Merge Record B into A
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
