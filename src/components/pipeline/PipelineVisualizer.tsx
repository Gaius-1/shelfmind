import React, { useState, useMemo, useCallback } from 'react'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from '@xyflow/react'
import type { Edge, Node, NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CustomNode, type CustomNodeData } from './CustomNode.tsx'
import { usePipelineStream } from '../../hooks/usePipelineStream'
import { NodeDetailsPanel } from './NodeDetailsPanel'

import { AlertCircle, CheckCircle2 } from 'lucide-react'

const nodeTypes = {
  customNode: CustomNode,
}

export function PipelineVisualizer({ jobId }: { jobId: string }) {
  const { data, isLoading } = usePipelineStream(jobId)
  
  // React Flow state hooks
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CustomNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // Sync TanStack Query data with React Flow local state
  React.useEffect(() => {
    if (data) {
      setNodes(data.nodes)
      setEdges(data.edges)
    }
  }, [data, setNodes, setEdges])

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(node.id)
  }, [])

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) as Node<CustomNodeData> | null
  }, [nodes, selectedNodeId])

  const selectedNodeLogs = useMemo(() => {
    if (!data || !selectedNodeId) return []
    return data.logs[selectedNodeId] || []
  }, [data, selectedNodeId])

  const overallStatus = useMemo(() => {
    if (!nodes.length) return 'pending'
    if (nodes.some(n => n.data.status === 'failed')) return 'failed'
    if (nodes.every(n => n.data.status === 'completed')) return 'completed'
    return 'processing'
  }, [nodes])

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-[80vh] flex items-center justify-center rounded-xl overflow-hidden bg-background">
        <div className="animate-pulse text-muted-foreground flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          Connecting to pipeline stream...
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full min-h-[80vh] rounded-xl overflow-hidden bg-background relative">
      {overallStatus === 'failed' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-full shadow-lg backdrop-blur-md">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-bold tracking-wide">Pipeline Failed</span>
        </div>
      )}
      {overallStatus === 'completed' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/20 text-success-foreground rounded-full shadow-lg backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-bold tracking-wide">Pipeline Completed</span>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        colorMode="system"
      >
        <Background gap={24} size={2} className="opacity-40" />
        <Controls showInteractive={false} className="bg-background border-border fill-foreground [&>button]:border-border [&>button]:bg-background [&>button]:fill-foreground hover:[&>button]:bg-muted" />
      </ReactFlow>

      <NodeDetailsPanel 
        node={selectedNode || null}
        logs={selectedNodeLogs}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  )
}
