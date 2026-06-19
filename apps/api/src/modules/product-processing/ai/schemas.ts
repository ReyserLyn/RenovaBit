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
	description: z
		.string()
		// Reject HTML break-out sequences at the AI source. The storefront
		// also escapes </ when injecting JSON-LD.
		.refine((val) => !val.includes("</"), "Unsafe HTML break-out in description"),
	specifications: z.array(productSpecSchema),
	needsReview: z.boolean(),
});

export type ProductExtractionOutput = z.infer<typeof productExtractionSchema>;
