// ── Product within an offer ─────────────────────────

export interface OfferProduct {
	id: string;
	name: string;
	slug: string;
	primaryImage: string | null;
	brand: { id: string; name: string; slug: string } | null;
	/** Role-aware price WITHOUT offer (base for comparison) */
	basePrice: string | null;
	/** Role-aware price WITH offer applied */
	offerPrice: string | null;
	/** Computed discount percent (0–100) */
	discountPercent: number;
	inStock: boolean;
	stock: number;
}

// ── Product page within an offer section ────────────

export interface OfferProductPage {
	items: OfferProduct[];
	/** Offset for the next page. Null when all products returned. */
	nextOffset: number | null;
	total: number;
}

// ── Offer in the consolidated list ──────────────────

export interface OfferWithProducts {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	discountValue: string;
	isFeatured: boolean;
	startsAt: string | Date;
	endsAt: string | Date;
	products: OfferProductPage;
}

// ── Filter brand item ───────────────────────────────

export interface OfferBrandItem {
	id: string;
	name: string;
	slug: string;
}

// ── Top-level response ──────────────────────────────

export interface OffersListResponse {
	offers: OfferWithProducts[];
	filters: {
		brands: OfferBrandItem[];
	};
}
