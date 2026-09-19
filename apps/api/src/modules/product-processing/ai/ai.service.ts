import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { logger } from "@/utils/logger";
import { AI_MODEL, type AiUsage } from "./pricing";
import { buildExtractionPrompt, type ExtractionContext } from "./prompts";
import { sanitizeRawName } from "./sanitize";
import { type ProductExtractionOutput, productExtractionSchema } from "./schemas";

/**
 * Cheapest provider first (DeepInfra, fp8), then other fp8 endpoints and the
 * official one. Fallbacks stay enabled so a provider outage degrades price and
 * latency instead of failing every import of the sync.
 *
 * Verified against OpenRouter: deepseek-v4.1-flash costs the same as
 * gpt-4o-mini ($0.15/$0.60 per M) on the official endpoint and $0.14/$0.42 on
 * DeepInfra, at fp8 rather than fp4 quantization.
 */
const PROVIDER_ORDER = ["DeepInfra", "Morph", "DeepSeek"];

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL = AI_MODEL;

const extractionModel = openrouter.chat(MODEL, {
	provider: { order: PROVIDER_ORDER, allow_fallbacks: true },
	usage: { include: true },
	// Extraction is a mechanical transform, not a reasoning task: without this
	// the model "thinks" for ~20s per product (measured), which would turn a
	// 900-product import into an hour of wall time.
	reasoning: { effort: "none" },
});
const AI_TIMEOUT_MS = 30_000;
const AI_MAX_RETRIES = 1;
const AI_RETRY_DELAY_MS = 1000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), ms)),
	]);
}

/** Extraction output plus what the call cost, so callers can report usage. */
export interface ExtractionCallResult {
	output: ProductExtractionOutput;
	usage: AiUsage;
}

export async function extractFromRawName(
	rawName: string,
	context: ExtractionContext,
): Promise<ExtractionCallResult> {
	const prompt = buildExtractionPrompt(sanitizeRawName(rawName), context);
	let lastError: unknown;

	for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
		try {
			const { output, usage } = await withTimeout(
				generateText({
					model: extractionModel,
					output: Output.object({ schema: productExtractionSchema }),
					prompt,
					temperature: 0,
					// Actually cancels the request when the deadline passes; the race
					// below stays as the last resort against a hung promise.
					abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
				}),
				AI_TIMEOUT_MS,
			);

			return {
				output: {
					...output,
					specifications: output.specifications.map((s) => ({
						id: s.id || crypto.randomUUID(),
						key: s.key,
						value: s.value,
					})),
					needsReview: output.needsReview ?? true,
				},
				usage: {
					inputTokens: usage.inputTokens ?? 0,
					outputTokens: usage.outputTokens ?? 0,
				},
			};
		} catch (error) {
			lastError = error;
			if (attempt < AI_MAX_RETRIES) {
				logger.withMetadata({ rawName, attempt }).warn("IA falló, reintentando...");
				await new Promise((r) => setTimeout(r, AI_RETRY_DELAY_MS * (attempt + 1)));
			}
		}
	}

	logger
		.withMetadata({ rawName, attempts: AI_MAX_RETRIES + 1 })
		.withError(lastError)
		.warn("IA falló después de reintentos, se reintentará en próximo sync");
	throw lastError;
}
