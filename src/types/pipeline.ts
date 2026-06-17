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
		position: { x: 450, y: 250 },
		data: {
			title: "RolmOCR Transcription",
			description: "Perception: High-fidelity document text extraction.",
			iconType: "vision",
			badge: "REDUCTO",
			status: "pending",
		},
	},
	{
		id: "watermark",
		type: "customNode",
		position: { x: 850, y: 250 },
		data: {
			title: "Watermark Parsing",
			description: "Extract and apply physical barcode tag overrides.",
			iconType: "barcode",
			badge: "RULES",
			status: "pending",
		},
	},
	{
		id: "bgremoval",
		type: "customNode",
		position: { x: 1250, y: 250 },
		data: {
			title: "BG Removal",
			description: "AI segmentation isolates product from shelf background.",
			iconType: "vision",
			badge: "AI",
			status: "pending",
		},
	},
	{
		id: "structured",
		type: "customNode",
		position: { x: 1650, y: 250 },
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
		position: { x: 2050, y: 250 },
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
		position: { x: 2450, y: 250 },
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
		position: { x: 2850, y: 250 },
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
		target: "watermark",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e_watermark_bg",
		source: "watermark",
		target: "bgremoval",
		animated: false,
		type: "smoothstep",
		style: { strokeWidth: 2 },
	},
	{
		id: "e_bg_structured",
		source: "bgremoval",
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
