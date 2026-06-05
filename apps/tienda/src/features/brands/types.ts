/** Marca en listado público (navbar, filtros) */
export interface BrandListItem {
	id: string;
	name: string;
	slug: string;
	imageUrl: string | null;
	productCount: number;
}

/** Detalle de marca (página individual) */
export interface BrandDetail extends BrandListItem {
	description: string | null;
}
