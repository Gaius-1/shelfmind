import React, { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '#/components/ui/sheet.tsx'
import { ScrollArea } from '#/components/ui/scroll-area.tsx'
import { Button } from '#/components/ui/button.tsx'
import type { Node } from '@xyflow/react'
import type { CustomNodeData } from './CustomNode.tsx'
import type { LogEntry } from '../../types/pipeline'

interface NodeDetailsPanelProps {
  node: Node<CustomNodeData> | null
  logs: LogEntry[]
  onClose: () => void
}

export function NodeDetailsPanel({ node, logs, onClose }: NodeDetailsPanelProps) {
  const isOpen = !!node
  const [isLogsExpanded, setIsLogsExpanded] = useState(true)

  // Keep logs open by default. If a user manually closes them, that's fine,
  // but if the node hits an error, we force them back open.
  useEffect(() => {
    if (node?.data.status === 'error') {
      setIsLogsExpanded(true)
    }
  }, [node?.id, node?.data.status])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex flex-col gap-0 space-y-0 w-[400px] sm:w-[540px] sm:max-w-[540px] border-l border-border bg-card/95 backdrop-blur-md">
        {node && (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center justify-between pr-8">
                <SheetTitle className="text-xl font-bold font-outfit">{node.data.title}</SheetTitle>
                <div className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider
                  ${node.data.status === 'completed' ? 'bg-success/20 text-success-foreground' : 
                    node.data.status === 'active' ? 'bg-primary/20 text-primary-foreground animate-pulse' : 
                    node.data.status === 'error' ? 'bg-destructive/20 text-destructive font-bold animate-pulse' :
                    'bg-muted text-muted-foreground'}`}>
                  {node.data.status}
                </div>
              </div>
              <SheetDescription className="font-medium text-muted-foreground">
                {node.data.description}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="h-[calc(100vh-180px)] flex-1 grow pb-4">
              <div className="space-y-4 px-4 py-2 flex flex-col items-start w-full">
                <div className="w-full flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold tracking-tight text-foreground/80 uppercase">
                    Execution Logs
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs" 
                    onClick={() => setIsLogsExpanded(!isLogsExpanded)}
                  >
                    {isLogsExpanded ? 'Hide Details' : 'Show Details'}
                  </Button>
                </div>
                
                {isLogsExpanded && (
                  <div className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-4 font-mono text-[13px] shadow-inner">
                    {logs.length === 0 ? (
                      <div className="text-zinc-500 italic">
                        Waiting for logs...
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {logs.map((log) => (
                          <div key={log.id} className="flex gap-3">
                            <span className="text-zinc-500 shrink-0 select-none">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 })}
                            </span>
                            <span className={`break-words ${
                              log.type === 'error' ? 'text-red-400' :
                              log.type === 'success' ? 'text-emerald-400' :
                              log.type === 'warning' ? 'text-amber-400' :
                              'text-zinc-100'
                            }`}>
                              {log.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <SheetFooter className="pt-4 border-t border-border/50">
              <SheetClose asChild>
                <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>Close panel</Button>
              </SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
