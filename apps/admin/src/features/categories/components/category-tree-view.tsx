import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@renovabit/ui/lib/utils";
import { useState } from "react";
import type { CategoryTreeNode } from "../model";

interface CategoryTreeViewProps {
	categories: CategoryTreeNode[];
	className?: string;
}

function TreeNode({ node, depth }: { node: CategoryTreeNode; depth: number }) {
	const [isExpanded, setIsExpanded] = useState(true);
	const hasChildren = node.children.length > 0;

	return (
		<div>
			<button
				type="button"
				onClick={() => hasChildren && setIsExpanded(!isExpanded)}
				className={cn(
					"flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent",
					depth === 0 && "font-medium",
				)}
				style={{ paddingLeft: `${12 + depth * 20}px` }}
			>
				{hasChildren ? (
					<HugeiconsIcon
						icon={ArrowDown01Icon}
						className={cn(
							"size-3.5 shrink-0 text-muted-foreground transition-transform",
							!isExpanded && "-rotate-90",
						)}
					/>
				) : (
					<span className="size-3.5 shrink-0" />
				)}
				<span className="truncate">{node.name}</span>
				{!node.isActive && (
					<span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
						inactiva
					</span>
				)}
				{!node.isVisibleInNav && (
					<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
						oculta
					</span>
				)}
				{node.isFeatured && (
					<span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
						destacada
					</span>
				)}
			</button>
			{hasChildren && isExpanded && (
				<div>
					{node.children.map((child) => (
						<TreeNode key={child.id} node={child} depth={depth + 1} />
					))}
				</div>
			)}
		</div>
	);
}

export function CategoryTreeView({ categories, className }: CategoryTreeViewProps) {
	if (categories.length === 0) return null;

	return (
		<div className={cn("rounded-lg border p-3 bg-card", className)}>
			<div className="mb-2 px-2 text-xs font-medium text-muted-foreground">
				Así se verá el orden y la jerarquía de tus categorías.
			</div>
			{categories.map((node) => (
				<TreeNode key={node.id} node={node} depth={0} />
			))}
		</div>
	);
}
