import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Frame, FramePanel, FrameHeader, FrameTitle, FrameDescription } from '#/components/reui/frame.tsx'
import { Badge } from '#/components/reui/badge.tsx'
import { HugeiconsIcon } from '@hugeicons/react'
import { 
  CloudUploadIcon, 
  AiScanIcon, 
  Search01Icon,
  Layers01Icon, 
  GitMergeIcon, 
  TaskDone01Icon, 
  Database01Icon,
  SearchList01Icon,
  CheckListIcon,
  PackageIcon
} from '@hugeicons/core-free-icons'

const iconMap: Record<string, any> = {
  upload: CloudUploadIcon,
  barcode: AiScanIcon,
  ocr: AiScanIcon,
  vision: PackageIcon,
  grouping: Layers01Icon,
  aggregation: GitMergeIcon,
  normalization: TaskDone01Icon,
  database: Database01Icon,
  deduplication: SearchList01Icon,
}

import { Cloudflare } from '#/components/ui/svgs/cloudflare.tsx'
import { Sqlite } from '#/components/ui/svgs/sqlite.tsx'
import { QwenLight } from '#/components/ui/svgs/qwenLight.tsx'

export type CustomNodeData = {
  title: string
  description: string
  iconType: keyof typeof iconMap
  status?: 'pending' | 'active' | 'completed' | 'failed'
  badge?: string
  processedCount?: number
  totalCount?: number
}

export const CustomNode = memo(({ data, isConnectable }: NodeProps) => {
  const nodeData = data as CustomNodeData
  
  // Status styling
  let ringClass = "border-transparent"
  if (nodeData.status === 'active') ringClass = "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
  if (nodeData.status === 'completed') ringClass = "ring-2 ring-success ring-offset-1 ring-offset-background"
  if (nodeData.status === 'failed') ringClass = "ring-2 ring-destructive ring-offset-1 ring-offset-background"

  // Custom Icon Rendering
  let IconContent = null
  if (nodeData.iconType === 'upload') {
    IconContent = <Cloudflare className="w-5 h-5" />
  } else if (nodeData.iconType === 'database') {
    IconContent = <Cloudflare className="w-5 h-5" />
  } else if (nodeData.iconType === 'vision') {
    IconContent = <QwenLight className="w-5 h-5 text-foreground" />
  } else if (nodeData.iconType === 'ocr') {
    IconContent = (
      <div className="flex items-center gap-1.5">
        <QwenLight className="w-4 h-4 text-foreground" />
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2.5} className="size-4 text-foreground" />
      </div>
    )
  } else {
    const Icon = iconMap[nodeData.iconType as string] || TaskDone01Icon
    IconContent = <HugeiconsIcon icon={Icon} strokeWidth={2} className="size-4" />
  }

  return (
    <div className={`w-[280px] ${ringClass} rounded-(--frame-radius) transition-all duration-300`}>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-3 h-3 border-2 border-background bg-muted-foreground"
      />
      
      <Frame spacing="sm" className="shadow-lg bg-card">
        <FramePanel>
          <FrameHeader className="flex flex-row items-start justify-between pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 flex items-center justify-center rounded-md bg-primary/10 text-primary min-w-7 min-h-7">
                {IconContent}
              </div>
              <FrameTitle className="text-[13px]">{nodeData.title}</FrameTitle>
            </div>
            <div className="flex items-center gap-1.5">
              {nodeData.processedCount !== undefined && nodeData.totalCount !== undefined && (
                <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                  {nodeData.processedCount} / {nodeData.totalCount}
                </span>
              )}
              {nodeData.badge && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider h-5 px-1.5">
                  {nodeData.badge}
                </Badge>
              )}
            </div>
          </FrameHeader>
          <div className="px-3 pb-3">
            <FrameDescription className="text-xs">
              {nodeData.description}
            </FrameDescription>
          </div>
        </FramePanel>
      </Frame>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-3 h-3 border-2 border-background bg-muted-foreground"
      />
    </div>
  )
})
