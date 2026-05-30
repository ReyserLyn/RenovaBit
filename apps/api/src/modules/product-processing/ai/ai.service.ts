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
		logger
			.withMetadata({ rawName })
			.withError(error)
			.warn("IA falló, se reintentará en próximo sync");
		throw error;
	}
}
