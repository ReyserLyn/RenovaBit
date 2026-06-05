/** Nodo del árbol jerárquico de categorías (recursivo, público).
 * children es unknown[] porque el schema usa t.Unknown() — limitación
 * de tipos recursivos en Elysia. En runtime siempre es CategoryTreeNode[]. */
export interface CategoryTreeNode {
	id: string;
	name: string;
	slug: string;
	imageUrl: string | null;
	description: string | null;
	productCount: number;
	children: unknown[];
}

/** Detalle de categoría (incluye breadcrumb) */
export interface CategoryDetail {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	imageUrl: string | null;
	isFeatured: boolean;
	breadcrumb: BreadcrumbItem[];
	productCount: number;
}

/** Item del breadcrumb de categoría */
export interface BreadcrumbItem {
	id: string;
	name: string;
	slug: string;
}
