export interface CategoryTreeNode {
	id: string;
	name: string;
	slug: string;
	children: CategoryTreeNode[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizeCategoryNode(value: unknown): CategoryTreeNode | null {
	if (!isRecord(value)) return null;

	const id = typeof value.id === "string" ? value.id : null;
	const name = typeof value.name === "string" ? value.name : null;
	const slug = typeof value.slug === "string" ? value.slug : null;
	if (!id || !name || !slug) return null;

	const rawChildren = Array.isArray(value.children) ? value.children : [];
	const children = rawChildren
		.map((child) => normalizeCategoryNode(child))
		.filter((child): child is CategoryTreeNode => child !== null);

	return { id, name, slug, children };
}

export function normalizeCategoryTree(tree: unknown): CategoryTreeNode[] {
	if (!Array.isArray(tree)) return [];
	return tree
		.map((node) => normalizeCategoryNode(node))
		.filter((node): node is CategoryTreeNode => node !== null);
}
