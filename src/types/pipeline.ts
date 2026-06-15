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
		id: "ocr",
		type: "customNode",
		position: { x: 350, y: 250 },
		data: {
			title: "Google Cloud Vision",
			description: "Perception: Extracts raw text perfectly.",
			iconType: "vision",
			badge: "ENTERPRISE",
			status: "pending",
		},
	},
	{
		id: "structured",
		type: "customNode",
		position: { x: 650, y: 250 },
		data: {
			title: "Qwen3-VL Extraction",
			description: "Cognition: Maps OCR text to JSON schema.",
			iconType: "vision",
			status: "pending",
		},
	},
	{
		id: "grouping",
		type: "customNode",
		position: { x: 950, y: 250 },
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
		position: { x: 1250, y: 250 },
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
		position: { x: 1550, y: 250 },
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
		target: "ocr",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e_ocr",
		source: "ocr",
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
