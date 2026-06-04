export interface Category {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	imageUrl: string | null;

	parentId: string | null;
	path: string | null;
	sortOrder: number | null;

	isFeatured: boolean;
	isActive: boolean;
	isVisibleInNav: boolean;

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

/** Nodo del árbol jerárquico de categorías (recursivo) */
export interface CategoryTreeNode {
	id: string;
	name: string;
	slug: string;
	imageUrl: string | null;
	description: string | null;
	sortOrder: number | null;
	isFeatured: boolean;
	isActive: boolean;
	isVisibleInNav: boolean;
	children: CategoryTreeNode[];
}

/** Item del breadcrumb de categoría */
export interface BreadcrumbItem {
	id: string;
	name: string;
	slug: string;
}

// ── Parámetros de consulta ───────────────────────────────────

export interface CategoryListParams {
	includeInactive?: boolean;
	isFeatured?: boolean;
	parentId?: string;
	isVisibleInNav?: boolean;
}

export interface CategoryTreeParams {
	includeInactive?: boolean;
}

export interface CategoryBreadcrumbParams {
	includeInactive?: boolean;
}
