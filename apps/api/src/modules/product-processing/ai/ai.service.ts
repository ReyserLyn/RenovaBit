import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { logger } from "@/utils/logger";
import { buildExtractionPrompt, type ExtractionContext } from "./prompts";
import { type ProductExtractionOutput, productExtractionSchema } from "./schemas";

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL = "openai/gpt-4o-mini";
const AI_TIMEOUT_MS = 30_000;
const AI_MAX_RETRIES = 1;
const AI_RETRY_DELAY_MS = 1000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), ms)),
	]);
}

export async function extractFromRawName(
	rawName: string,
	context: ExtractionContext,
): Promise<ProductExtractionOutput> {
	const prompt = buildExtractionPrompt(rawName, context);
	let lastError: unknown;

	for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
		try {
			const { output } = await withTimeout(
				generateText({
					model: openrouter(MODEL),
					output: Output.object({ schema: productExtractionSchema }),
					prompt,
					temperature: 0,
				}),
				AI_TIMEOUT_MS,
			);

			return {
				...output,
				specifications: output.specifications.map((s) => ({
					id: s.id || crypto.randomUUID(),
					key: s.key,
					value: s.value,
				})),
				needsReview: output.needsReview ?? true,
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
