/** Imagen principal en listados */
export interface ProductPrimaryImage {
	url: string;
	alt: string | null;
}

/** Referencia mínima a marca (listados) */
export interface ProductBrandRef {
	id: string;
	name: string;
	slug: string;
}

/** Referencia a categoría */
export interface ProductCategoryRef {
	id: string;
	name: string;
	slug: string;
}

/** Referencia a oferta activa (shape del API: PublicOfferRef) */
export interface OfferRef {
	id: string;
	name: string;
	slug: string;
	/**
	 * Discount is always a percentage (0–100). The fixed_amount type was
	 * removed from the simplified offers model — the API only ever returns
	 * percentage-based offers now.
	 */
	discountValue: string;
	isFeatured: boolean;
}

/** Producto en listado público (cards, grids) */
export interface ProductListItem {
	id: string;
	name: string;
	slug: string;
	price: string;
	/** Role-aware offer price (null/undefined when no active offer applies) */
	offerPrice?: string | null;
	/** Discount percent (0–100), present only when offer applies */
	discountPercent?: number | null;
	stock: number;
	sku: string;
	isFeatured: boolean;
	primaryImage: ProductPrimaryImage | null;
	brand: ProductBrandRef | null;
	category: ProductCategoryRef | null;
	/** Texto destacado con marcadores &lt;b&gt; de ts_headline (solo búsqueda FTS) */
	headline?: string | null;
	/** Disponibilidad considerando reservas (solo búsqueda FTS) */
	isInStock?: boolean;
	/** Ofertas activas aplicables al producto (ya filtradas por backend) */
	offers?: OfferRef[];
}
