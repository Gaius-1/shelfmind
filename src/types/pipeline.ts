import type { Edge, Node } from "@xyflow/react";
import type { CustomNodeData } from "../components/pipeline/CustomNode.tsx";

export type NodeStatus = "pending" | "active" | "completed" | "failed";

export interface LogEntry {
	id: string;
	timestamp: string;
	message: string;
	type: "info" | "success" | "warning" | "error";
}

export interface PipelineState {
	jobId: string;
	nodes: Node<CustomNodeData>[];
	edges: Edge[];
	logs: Record<string, LogEntry[]>; // mapping nodeId to its logs
}

export const initialNodes: Node<CustomNodeData>[] = [
	{
		id: "upload",
		type: "customNode",
		position: { x: 50, y: 250 },
		data: {
			title: "Image Ingestion",
			description: "Images uploaded to Cloudflare R2 bucket.",
			iconType: "upload",
			status: "pending",
		},
	},
	{
		id: "zxing",
		type: "customNode",
		position: { x: 400, y: 50 },
		data: {
			title: "ZXing Scanning",
			description: "WASM-based local barcode extraction.",
			iconType: "barcode",
			status: "pending",
			badge: "< 100ms",
		},
	},
	{
		id: "ocr",
		type: "customNode",
		position: { x: 400, y: 250 },
		data: {
			title: "VLM Raw OCR",
			description: "Qwen2.5-VL extracts raw label text.",
			iconType: "ocr",
			status: "active",
			badge: "Workers AI",
			processedCount: 5,
			totalCount: 20,
		},
	},
	{
		id: "structured",
		type: "customNode",
		position: { x: 400, y: 450 },
		data: {
			title: "VLM Structured JSON",
			description: "AI parses exact product fields.",
			iconType: "vision",
			status: "pending",
			badge: "Workers AI",
		},
	},
	{
		id: "grouping",
		type: "customNode",
		position: { x: 750, y: 250 },
		data: {
			title: "Multi-Image Grouping",
			description: "Greedy Bipartite Matcher resolving mixed fronts & backs.",
			iconType: "grouping",
			status: "pending",
		},
	},
	{
		id: "aggregation",
		type: "customNode",
		position: { x: 1100, y: 250 },
		data: {
			title: "Aggregation Engine",
			description: "Merges candidates and calculates confidence.",
			iconType: "aggregation",
			status: "pending",
		},
	},
	{
		id: "normalization",
		type: "customNode",
		position: { x: 1450, y: 250 },
		data: {
			title: "Normalization & Threshold",
			description: "Cleans strings, formats, flags low confidence.",
			iconType: "normalization",
			status: "pending",
		},
	},
	{
		id: "database",
		type: "customNode",
		position: { x: 1800, y: 250 },
		data: {
			title: "Database Write",
			description: "Inserts records to Neon Postgres / SQLite.",
			iconType: "database",
			status: "pending",
		},
	},
	{
		id: "deduplication",
		type: "customNode",
		position: { x: 2150, y: 250 },
		data: {
			title: "Deduplication Engine",
			description: "Post-job scan against existing active records.",
			iconType: "deduplication",
			status: "pending",
		},
	},
];

export const initialEdges: Edge[] = [
	{
		id: "e1",
		source: "upload",
		target: "zxing",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e2",
		source: "upload",
		target: "ocr",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e3",
		source: "upload",
		target: "structured",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},

	{
		id: "e4",
		source: "zxing",
		target: "grouping",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e5",
		source: "ocr",
		target: "grouping",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e6",
		source: "structured",
		target: "grouping",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},

	{
		id: "e7",
		source: "grouping",
		target: "aggregation",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e8",
		source: "aggregation",
		target: "normalization",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e9",
		source: "normalization",
		target: "database",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e10",
		source: "database",
		target: "deduplication",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
];
