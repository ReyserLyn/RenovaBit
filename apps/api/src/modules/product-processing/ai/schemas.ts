import { z } from "zod";

export const productSpecSchema = z.object({
	id: z.string(),
	key: z.string(),
	value: z.string(),
});

export const productExtractionSchema = z.object({
	name: z.string().min(1),
	brand: z.string(),
	category: z.string(),
	description: z.string(),
	specifications: z.array(productSpecSchema),
	needsReview: z.boolean(),
});

export type ProductExtractionOutput = z.infer<typeof productExtractionSchema>;
