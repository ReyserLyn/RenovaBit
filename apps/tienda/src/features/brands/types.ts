export interface Brand {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	imageUrl: string | null;

	isActive: boolean;
	isFeatured: boolean;

	createdBy: string | null;
	updatedBy: string | null;

	/** SEO */
	seoTitle: string | null;
	seoDescription: string | null;
	seoKeywords: string | null;

	/** Timestamps */
	createdAt: Date;
	updatedAt: Date;
}
