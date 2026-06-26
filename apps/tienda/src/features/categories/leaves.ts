// Extrae las categorías hoja (sin hijos) del árbol. Solo leaves para evitar
// duplicados en el filtro multi-select. Filtra hojas sin productos y ordena
// alfabéticamente. Acepta `unknown` + type guard porque el API devuelve
// `children: t.Array(t.Unknown())` (workaround Elysia para tipos recursivos).

export interface LeafCategory {
	id: string;
	name: string;
	slug: string;
	productCount: number;
}

interface TreeNode {
	id: string;
	name: string;
	slug: string;
	productCount: number;
	children: unknown[];
}

function isTreeNode(value: unknown): value is TreeNode {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.id === "string" &&
		typeof v.name === "string" &&
		typeof v.slug === "string" &&
		typeof v.productCount === "number" &&
		Array.isArray(v.children)
	);
}

export function getLeafCategories(tree: unknown): LeafCategory[] {
	const leaves: LeafCategory[] = [];
	function walk(nodes: unknown): void {
		if (!Array.isArray(nodes)) return;
		for (const node of nodes) {
			if (!isTreeNode(node)) continue;
			if (node.children.length === 0 && node.productCount > 0) {
				leaves.push({
					id: node.id,
					name: node.name,
					slug: node.slug,
					productCount: node.productCount,
				});
			} else {
				walk(node.children);
			}
		}
	}
	walk(tree);
	return leaves.sort((a, b) => a.name.localeCompare(b.name, "es"));
}
