import React, { useMemo } from 'react'
import { ReactFlow, Background, Controls, Position } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CustomNode, type CustomNodeData } from './CustomNode.tsx'

const nodeTypes = {
  customNode: CustomNode,
}

const initialNodes: Node<CustomNodeData>[] = [
  {
    id: 'upload',
    type: 'customNode',
    position: { x: 50, y: 250 },
    data: {
      title: 'Image Ingestion',
      description: 'Images uploaded to Cloudflare R2 bucket.',
      iconType: 'upload',
      status: 'completed',
    },
  },
  {
    id: 'zxing',
    type: 'customNode',
    position: { x: 400, y: 50 },
    data: {
      title: 'ZXing Scanning',
      description: 'WASM-based local barcode extraction.',
      iconType: 'barcode',
      status: 'completed',
      badge: '< 100ms'
    },
  },
  {
    id: 'ocr',
    type: 'customNode',
    position: { x: 400, y: 250 },
    data: {
      title: 'VLM Raw OCR',
      description: 'Qwen2.5-VL extracts raw label text.',
      iconType: 'ocr',
      status: 'active',
      badge: 'Workers AI'
    },
  },
  {
    id: 'structured',
    type: 'customNode',
    position: { x: 400, y: 450 },
    data: {
      title: 'VLM Structured JSON',
      description: 'AI parses exact product fields.',
      iconType: 'vision',
      status: 'active',
      badge: 'Workers AI'
    },
  },
  {
    id: 'grouping',
    type: 'customNode',
    position: { x: 750, y: 250 },
    data: {
      title: 'Multi-Image Grouping',
      description: 'Groups multiple angles of same product.',
      iconType: 'grouping',
      status: 'pending',
    },
  },
  {
    id: 'aggregation',
    type: 'customNode',
    position: { x: 1100, y: 250 },
    data: {
      title: 'Aggregation Engine',
      description: 'Merges candidates and calculates confidence.',
      iconType: 'aggregation',
      status: 'pending',
    },
  },
  {
    id: 'normalization',
    type: 'customNode',
    position: { x: 1450, y: 250 },
    data: {
      title: 'Normalization & Threshold',
      description: 'Cleans strings, formats, flags low confidence.',
      iconType: 'normalization',
      status: 'pending',
    },
  },
  {
    id: 'database',
    type: 'customNode',
    position: { x: 1800, y: 250 },
    data: {
      title: 'Database Write',
      description: 'Inserts records to Neon Postgres / SQLite.',
      iconType: 'database',
      status: 'pending',
    },
  },
  {
    id: 'deduplication',
    type: 'customNode',
    position: { x: 2150, y: 250 },
    data: {
      title: 'Deduplication Engine',
      description: 'Post-job scan against existing active records.',
      iconType: 'deduplication',
      status: 'pending',
    },
  },
]

const initialEdges: Edge[] = [
  { id: 'e1', source: 'upload', target: 'zxing', animated: true, type: 'smoothstep', style: { stroke: 'var(--color-success)', strokeWidth: 2 } },
  { id: 'e2', source: 'upload', target: 'ocr', animated: true, type: 'smoothstep', style: { stroke: 'var(--color-primary)', strokeWidth: 2 } },
  { id: 'e3', source: 'upload', target: 'structured', animated: true, type: 'smoothstep', style: { stroke: 'var(--color-primary)', strokeWidth: 2 } },
  
  { id: 'e4', source: 'zxing', target: 'grouping', animated: true, type: 'smoothstep', style: { stroke: 'var(--color-success)', strokeWidth: 2 } },
  { id: 'e5', source: 'ocr', target: 'grouping', animated: false, type: 'smoothstep', style: { strokeWidth: 2 } },
  { id: 'e6', source: 'structured', target: 'grouping', animated: false, type: 'smoothstep', style: { strokeWidth: 2 } },
  
  { id: 'e7', source: 'grouping', target: 'aggregation', animated: false, type: 'smoothstep', style: { strokeWidth: 2 } },
  { id: 'e8', source: 'aggregation', target: 'normalization', animated: false, type: 'smoothstep', style: { strokeWidth: 2 } },
  { id: 'e9', source: 'normalization', target: 'database', animated: false, type: 'smoothstep', style: { strokeWidth: 2 } },
  { id: 'e10', source: 'database', target: 'deduplication', animated: false, type: 'smoothstep', style: { strokeWidth: 2 } },
]

export function PipelineVisualizer() {
  return (
    <div className="w-full h-full min-h-[80vh] rounded-xl overflow-hidden bg-background">
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
      >
        <Background gap={24} size={2} className="opacity-40" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
