/** Imagen principal en listados */
export interface ProductPrimaryImage {
	url: string;
	alt: string | null;
}

/** Imagen en detalle de producto */
export interface ProductImage {
	id: string;
	url: string;
	alt: string | null;
	isPrimary: boolean;
}

/** Referencia mínima a marca (listados) */
export interface ProductBrandRef {
	id: string;
	name: string;
	slug: string;
}

/** Referencia a marca con imagen (detalle) */
export interface ProductBrandDetail extends ProductBrandRef {
	imageUrl: string | null;
}

/** Referencia a categoría */
export interface ProductCategoryRef {
	id: string;
	name: string;
	slug: string;
}

/** Especificación técnica */
export interface ProductSpecification {
	id: string;
	key: string;
	value: string;
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
}

/** Producto en detalle público (página individual) */
export interface ProductDetail {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	price: string;
	stock: number;
	sku: string;
	specifications: ProductSpecification[];
	images: ProductImage[];
	brand: ProductBrandDetail | null;
	category: ProductCategoryRef | null;
	createdAt: string;
}
