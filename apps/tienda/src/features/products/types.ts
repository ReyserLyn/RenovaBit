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

/** Producto en listado público (cards, grids) */
export interface ProductListItem {
	id: string;
	name: string;
	slug: string;
	price: string;
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
}
