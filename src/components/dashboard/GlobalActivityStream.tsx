import * as React from 'react'
import { Frame, FramePanel } from '#/components/reui/frame.tsx'
import { useGlobalStream } from '#/hooks/useGlobalStream.ts'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Activity01Icon,
  TerminalIcon,
  TickDouble01Icon,
  Alert01Icon,
  InformationCircleIcon,
  CancelCircleIcon
} from '@hugeicons/core-free-icons'

interface JobRow {
  id: string
  status: string
}

interface GlobalActivityStreamProps {
  activeJobs: JobRow[]
}

const getIcon = (type: string) => {
  switch (type) {
    case 'success': return <HugeiconsIcon icon={TickDouble01Icon} className="size-4 text-emerald-600 dark:text-emerald-500" />
    case 'warning': return <HugeiconsIcon icon={Alert01Icon} className="size-4 text-amber-600 dark:text-amber-500" />
    case 'error': return <HugeiconsIcon icon={CancelCircleIcon} className="size-4 text-rose-600 dark:text-rose-500" />
    default: return <HugeiconsIcon icon={InformationCircleIcon} className="size-4 text-blue-600 dark:text-blue-500" />
  }
}

export function GlobalActivityStream({ activeJobs }: GlobalActivityStreamProps) {
  const activeIds = React.useMemo(() => activeJobs.map(j => j.id), [activeJobs])
  const logs = useGlobalStream(activeIds)

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Activity01Icon} className="size-5 text-foreground" />
            <h2 className="text-lg font-medium text-foreground">Live Pipeline Feed</h2>
          </div>
          <p className="text-sm text-muted-foreground">Real-time extraction events across all active batches.</p>
        </div>
        {activeIds.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded-md">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-emerald-600"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {activeIds.length} Active
            </span>
          </div>
        )}
      </div>

      <Frame spacing="xs" className="flex-1">
        <FramePanel className="p-0 overflow-hidden flex-1 flex flex-col bg-card border-border shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border/50">
            <HugeiconsIcon icon={TerminalIcon} className="size-4 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">System Event Log</span>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[350px] p-2 bg-background font-mono text-sm">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-10">
                <span className="text-xs">Waiting for events...</span>
              </div>
            ) : (
              <div className="flex flex-col">
                {logs.map(log => (
                  <div key={log.id} className="flex gap-3 py-2 px-2 hover:bg-muted/50 rounded-sm border-b border-border/20 last:border-0 transition-colors animate-in fade-in slide-in-from-top-1">
                    <div className="shrink-0 pt-0.5">{getIcon(log.type)}</div>
                    <div className="flex-1 flex flex-col min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-xs font-semibold text-foreground truncate">
                          [{log.nodeId.toUpperCase()}]
                        </span>
                        <span className="text-[10px] text-muted-foreground border border-border/50 px-1 rounded-sm ml-auto shrink-0">
                          Job: {log.jobId.slice(0, 6)}
                        </span>
                      </div>
                      <span className="text-sm text-foreground/90 break-words">{log.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FramePanel>
      </Frame>
    </div>
  )
}
