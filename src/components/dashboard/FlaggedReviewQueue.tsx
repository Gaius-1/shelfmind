import * as React from 'react'
import { Frame, FramePanel } from '#/components/reui/frame.tsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table.tsx'
import { Badge } from '#/components/reui/badge.tsx'
import { cn } from '#/lib/utils.ts'
import { useProducts } from '#/hooks/useProducts.ts'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'

interface FlaggedReviewQueueProps {
  orgId: string
}

export function FlaggedReviewQueue({ orgId }: FlaggedReviewQueueProps) {
  const { data, isPending } = useProducts(orgId, { flagged: true })
  const navigate = useNavigate()

  const records = data?.records || []
  // Only show top 5 in the dashboard widget
  const displayRecords = records.slice(0, 5)

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
            Flagged Review Queue
            {records.length > 0 && (
              <span className="flex size-2 rounded-full bg-warning animate-pulse" />
            )}
          </h2>
          <p className="text-sm text-muted-foreground">Requires human intervention.</p>
        </div>
      </div>

      <Frame spacing="xs" className="flex-1">
        <FramePanel className="p-0! overflow-hidden flex-1 flex flex-col bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold h-10 w-[45%]">Item</TableHead>
                <TableHead className="font-semibold h-10 w-[35%]">Barcode</TableHead>
                <TableHead className="font-semibold h-10 w-[20%] text-right pr-4">Conf.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                    Loading queue...
                  </TableCell>
                </TableRow>
              ) : displayRecords.length > 0 ? (
                displayRecords.map((record) => (
                  <TableRow 
                    key={record.id} 
                    className="border-border/50 group cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => navigate({ to: '/review-queue/$recordId', params: { recordId: record.id } })}
                  >
                    <TableCell className="font-medium">
                      <div className="truncate max-w-[120px] 2xl:max-w-[160px]" title={record.ITEM_NAME}>
                        {record.ITEM_NAME || 'Unknown Item'}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <div className="truncate max-w-[100px]" title={record.BARCODE}>
                        {record.BARCODE || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      {record.confidence != null ? (
                        <span className={cn(
                          "font-medium",
                          record.confidence > 0.85 ? "text-success" : record.confidence > 0.7 ? "text-warning" : "text-destructive"
                        )}>
                          {(record.confidence * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-32">
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <AlertCircle className="size-5 opacity-50" />
                      <span className="text-sm">Queue is empty</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </FramePanel>
      </Frame>
    </div>
  )
}
