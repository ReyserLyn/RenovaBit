import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { CategoryCreateDialog } from "@/features/categories/components/category-create-dialog";
import { CategoryDeleteDialog } from "@/features/categories/components/category-delete-dialog";
import { CategoryEditDialog } from "@/features/categories/components/category-edit-dialog";
import { CategoryTable } from "@/features/categories/components/category-table";
import { CategoryTreeView } from "@/features/categories/components/category-tree-view";
import { buildCategoryTree, useCategories } from "@/features/categories/hooks";
import type { Category } from "@/features/categories/model";
import { PageHeader } from "@/shared/components/layout/page-header";
import { useCategoriesUIStore } from "@/shared/lib/stores/tables/categories-ui";

export const Route = createFileRoute("/_authenticated/categorias")({
	component: CategoriesPage,
});

function CategoriesPage() {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
	const { data: categories = [] } = useCategories();

	const treeData = useMemo(() => buildCategoryTree(categories), [categories]);
	const treeExpanded = useCategoriesUIStore((s) => s.treeExpanded);
	const setTreeExpanded = useCategoriesUIStore((s) => s.setTreeExpanded);

	const handleEdit = useCallback((category: Category) => {
		setSelectedCategory(category);
		setIsEditDialogOpen(true);
	}, []);

	const handleDelete = useCallback((category: Category) => {
		setSelectedCategory(category);
		setIsDeleteDialogOpen(true);
	}, []);

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Categorías"
				description="Gestiona las categorías para organizar tus productos."
				actions={
					<Button onClick={() => setIsCreateDialogOpen(true)}>
						<HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
						Nueva categoría
					</Button>
				}
			/>

			<CategoryCreateDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />

			<CategoryEditDialog
				category={selectedCategory}
				open={isEditDialogOpen}
				onOpenChange={setIsEditDialogOpen}
			/>

			<CategoryDeleteDialog
				category={selectedCategory}
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			/>

			<CategoryTable onEdit={handleEdit} onDelete={handleDelete} />

			<details
				className="group"
				open={treeExpanded}
				onToggle={(e) => setTreeExpanded(e.currentTarget.open)}
			>
				<summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
					Árbol jerárquico
				</summary>
				<CategoryTreeView categories={treeData} className="mt-3" />
			</details>
		</div>
	);
}
