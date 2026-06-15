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
		id: "structured",
		type: "customNode",
		position: { x: 400, y: 250 },
		data: {
			title: "Qwen3-VL Extraction",
			description: "Extracts JSON payload and imageTag.",
			iconType: "vision",
			status: "pending",
		},
	},
	{
		id: "grouping",
		type: "customNode",
		position: { x: 750, y: 250 },
		data: {
			title: "Map-based Grouping",
			description: "Merges records by imageTag or BARCODE.",
			iconType: "grouping",
			status: "pending",
		},
	},
	{
		id: "database",
		type: "customNode",
		position: { x: 1100, y: 250 },
		data: {
			title: "Database Write",
			description: "Inserts merged records to SQLite.",
			iconType: "database",
			status: "pending",
		},
	},
	{
		id: "deduplication",
		type: "customNode",
		position: { x: 1450, y: 250 },
		data: {
			title: "Merge Suggestions",
			description: "Post-job scan for duplicate pairs.",
			iconType: "deduplication",
			status: "pending",
		},
	},
];

export const initialEdges: Edge[] = [
	{
		id: "e1",
		source: "upload",
		target: "structured",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e2",
		source: "structured",
		target: "grouping",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e3",
		source: "grouping",
		target: "database",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e4",
		source: "database",
		target: "deduplication",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
];
