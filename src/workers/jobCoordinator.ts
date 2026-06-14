import { DurableObject } from "cloudflare:workers";
import type { PipelineState, LogEntry, NodeStatus } from "../types/pipeline";
import { initialNodes, initialEdges } from "../types/pipeline";

export interface Env {
	JOB_COORDINATOR: DurableObjectNamespace<JobCoordinator>;
}

export class JobCoordinator extends DurableObject<Env> {
	// State is persisted to DO SQLite so it survives hibernation and page refreshes
	private state: PipelineState;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// Initialize with defaults — will be overwritten by blockConcurrencyWhile restore below
		this.state = {
			jobId: "",
			nodes: [...initialNodes],
			edges: [...initialEdges],
			logs: {},
		};
		// Restore persisted state from storage on cold start (survives hibernation)
		this.ctx.blockConcurrencyWhile(async () => {
			const stored = await this.ctx.storage.get<PipelineState>("pipelineState");
			if (stored) {
				// Sync static node metadata from current initialNodes
				stored.nodes = stored.nodes.map((storedNode) => {
					const initialNode = initialNodes.find((n) => n.id === storedNode.id);
					if (initialNode) {
						return {
							...storedNode,
							data: {
								...storedNode.data,
								title: initialNode.data.title,
								description: initialNode.data.description,
							},
						};
					}
					return storedNode;
				});
				this.state = stored;
			}
		});
	} // Persist state to DO storage after every mutation
	private async persist() {
		await this.ctx.storage.put("pipelineState", this.state);
	}

	// --- REST Endpoint for TanStack Query (Initial Fetch) ---
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const jobId = url.searchParams.get("jobId") || "unknown";

		if (!this.state.jobId) {
			this.state.jobId = jobId;
		}

		// Handle WebSocket Upgrades
		if (request.headers.get("Upgrade") === "websocket") {
			const pair = new WebSocketPair();
			const client = pair[0];
			const server = pair[1];

			this.ctx.acceptWebSocket(server);

			// Send initial state upon connection
			server.send(JSON.stringify({ type: "init", state: this.state }));

			return new Response(null, { status: 101, webSocket: client });
		}

		// Handle standard REST GET for initial query
		if (request.method === "GET") {
			return Response.json(this.state);
		}

		return new Response("Not found", { status: 404 });
	}

	// --- WebSocket Handlers ---
	webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		// We could handle commands from the client here (e.g., 'pause', 'retry')
	}

	webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
		wasClean: boolean,
	) {
		// Handle disconnects if needed
	}

	// --- RPC Methods for Background Pipeline to Push Updates ---

	async updateNodeState(nodeId: string, status: NodeStatus) {
		this.state.nodes = this.state.nodes.map((node) =>
			node.id === nodeId ? { ...node, data: { ...node.data, status } } : node,
		);
		this.broadcast({ type: "node_update", nodeId, status });
		await this.persist();
	}

	async updateEdgeState(edgeId: string, animated: boolean, color: string) {
		this.state.edges = this.state.edges.map((edge) =>
			edge.id === edgeId
				? { ...edge, animated, style: { ...edge.style, stroke: color } }
				: edge,
		);
		this.broadcast({ type: "edge_update", edgeId, animated, color });
		await this.persist();
	}

	async addLog(
		nodeId: string,
		message: string,
		logType: "info" | "success" | "warning" | "error",
	) {
		const newLog: LogEntry = {
			id: crypto.randomUUID(),
			timestamp: new Date().toISOString(),
			message,
			type: logType,
		};

		if (!this.state.logs[nodeId]) {
			this.state.logs[nodeId] = [];
		}
		this.state.logs[nodeId].push(newLog);

		this.broadcast({ type: "log", nodeId, log: newLog });
		await this.persist();
	}

	// Helper to send to all connected clients
	private broadcast(data: any) {
		const message = JSON.stringify(data);
		for (const ws of this.ctx.getWebSockets()) {
			try {
				ws.send(message);
			} catch (err) {
				// Handle failed send
			}
		}
	}
}
