// ─── Vision Model Registry & Cost Accounting ────────────────────────────────
// Central catalogue of the vision models ShelfMind can run extraction on, plus
// the pricing used to turn token usage into a dollar cost. Selecting a model is
// per-job: the chosen id is stored on the job row and resolved here at runtime.

export interface ModelPricing {
	/** USD per 1,000,000 input (prompt) tokens. */
	inputPer1M: number;
	/** USD per 1,000,000 output (completion) tokens. */
	outputPer1M: number;
}

export interface VisionModelDef {
	/** Stable identifier persisted on the job row. */
	id: string;
	/** Human-friendly label for the picker. */
	label: string;
	/** Provider display name. */
	provider: string;
	/** Model string sent in the chat-completions request body. */
	modelName: string;
	/** Env var names checked (in order) for the provider API key. */
	apiKeyEnvKeys: string[];
	/** Env var names checked (in order) for an endpoint override. */
	endpointEnvKeys: string[];
	/** Fallback endpoint when no override env var is set. */
	defaultEndpoint: string;
	/**
	 * Approximate public list pricing (USD / 1M tokens). Used for cost estimates;
	 * not a billing source of truth.
	 */
	pricing: ModelPricing;
}

const QWEN_ENDPOINT =
	"https://ws-e8idycj2w4qgstsm.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

export const VISION_MODELS: VisionModelDef[] = [
	{
		id: "qwen3-vl-235b",
		label: "Qwen3-VL 235B Instruct",
		provider: "Alibaba Cloud",
		modelName: "qwen3-vl-235b-a22b-instruct",
		apiKeyEnvKeys: ["QWEN_API_KEY"],
		endpointEnvKeys: ["QWEN_API_ENDPOINT"],
		defaultEndpoint: QWEN_ENDPOINT,
		pricing: { inputPer1M: 0.7, outputPer1M: 2.8 },
	},
	{
		id: "qwen3-vl-30b",
		label: "Qwen3-VL 30B Instruct (faster / cheaper)",
		provider: "Alibaba Cloud",
		modelName: "qwen3-vl-30b-a3b-instruct",
		apiKeyEnvKeys: ["QWEN_API_KEY"],
		endpointEnvKeys: ["QWEN_API_ENDPOINT"],
		defaultEndpoint: QWEN_ENDPOINT,
		pricing: { inputPer1M: 0.2, outputPer1M: 0.8 },
	},
	{
		id: "qwen-vl-max",
		label: "Qwen-VL Max",
		provider: "Alibaba Cloud",
		modelName: "qwen-vl-max",
		apiKeyEnvKeys: ["QWEN_API_KEY"],
		endpointEnvKeys: ["QWEN_API_ENDPOINT"],
		defaultEndpoint: QWEN_ENDPOINT,
		pricing: { inputPer1M: 0.41, outputPer1M: 1.24 },
	},
	{
		id: "gpt-4o",
		label: "OpenAI GPT-4o (via OpenRouter)",
		provider: "OpenRouter",
		modelName: "openai/gpt-4o",
		apiKeyEnvKeys: ["OPENROUTER_API_KEY"],
		endpointEnvKeys: ["OPENROUTER_API_ENDPOINT"],
		defaultEndpoint: "https://openrouter.ai/api/v1/chat/completions",
		pricing: { inputPer1M: 2.5, outputPer1M: 10.0 },
	},
	{
		id: "gemini-2.0-flash",
		label: "Gemini 2.0 Flash (via OpenRouter)",
		provider: "OpenRouter",
		modelName: "google/gemini-2.0-flash-001",
		apiKeyEnvKeys: ["OPENROUTER_API_KEY"],
		endpointEnvKeys: ["OPENROUTER_API_ENDPOINT"],
		defaultEndpoint: "https://openrouter.ai/api/v1/chat/completions",
		pricing: { inputPer1M: 0.1, outputPer1M: 0.4 },
	},
];

export const DEFAULT_VISION_MODEL_ID = "qwen3-vl-235b";

/** Resolve a model definition by id, falling back to the default. */
export function getVisionModel(id?: string | null): VisionModelDef {
	if (id) {
		const found = VISION_MODELS.find((m) => m.id === id);
		if (found) return found;
	}
	return VISION_MODELS.find((m) => m.id === DEFAULT_VISION_MODEL_ID) as VisionModelDef;
}

/**
 * Client-safe view of the catalogue (no env var names / secrets). Used to render
 * the model picker on the upload page.
 */
export function listVisionModels(): Array<{
	id: string;
	label: string;
	provider: string;
	pricing: ModelPricing;
}> {
	return VISION_MODELS.map(({ id, label, provider, pricing }) => ({ id, label, provider, pricing }));
}

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
}

/** Parse an OpenAI-compatible `usage` object into a normalized TokenUsage. */
export function parseUsage(usage: unknown): TokenUsage {
	const u = (usage ?? {}) as Record<string, unknown>;
	const input = Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0;
	const output = Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0;
	return { inputTokens: input, outputTokens: output };
}

/** Compute the USD cost of a token usage given a pricing table. */
export function computeCost(pricing: ModelPricing, usage: TokenUsage): number {
	return (
		(usage.inputTokens / 1_000_000) * pricing.inputPer1M +
		(usage.outputTokens / 1_000_000) * pricing.outputPer1M
	);
}

/**
 * Resolve the runtime call config (endpoint + apiKey + model string) for a model
 * from the environment. Returns null when no API key is configured. Server-only.
 */
export function resolveModelRuntime(
	model: VisionModelDef,
	env: any = null,
): { endpoint: string; apiKey: string; modelName: string } | null {
	const readEnv = (key: string): string | undefined =>
		env?.[key] || (typeof process !== "undefined" ? process.env[key] : undefined);

	let apiKey: string | undefined;
	for (const key of model.apiKeyEnvKeys) {
		apiKey = readEnv(key);
		if (apiKey) break;
	}
	if (!apiKey) return null;

	let endpoint: string | undefined;
	for (const key of model.endpointEnvKeys) {
		endpoint = readEnv(key);
		if (endpoint) break;
	}

	return { endpoint: endpoint || model.defaultEndpoint, apiKey, modelName: model.modelName };
}

/** Format a USD cost for display (4 decimal places for small per-job costs). */
export function formatCost(cost?: number | null): string {
	if (cost == null || Number.isNaN(cost)) return "$0.0000";
	if (cost < 0.0001 && cost > 0) return "<$0.0001";
	return `$${cost.toFixed(4)}`;
}
