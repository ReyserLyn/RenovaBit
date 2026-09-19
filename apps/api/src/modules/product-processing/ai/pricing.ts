/**
 * Model and cost accounting for the extraction call.
 *
 * Cost used to be invisible: a sync run reported how many products it touched,
 * never what the model spent or whether its usage spiked. Keeping the prices
 * next to the model id makes every run able to report its own cost.
 */

export const AI_MODEL = "deepseek/deepseek-v4.1-flash";

/** Provider prices in USD per million tokens (DeepInfra fp8 endpoint). */
export const AI_PRICES = {
	inputPerMillion: 0.14,
	outputPerMillion: 0.42,
} as const;

export interface AiUsage {
	inputTokens: number;
	outputTokens: number;
}

export function estimateCostUsd(usage: AiUsage): number {
	return (
		(usage.inputTokens * AI_PRICES.inputPerMillion +
			usage.outputTokens * AI_PRICES.outputPerMillion) /
		1_000_000
	);
}
