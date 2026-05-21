import { cn } from "@renovabit/ui/lib/utils";
import * as React from "react";

interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: React.ReactNode;
	className?: string;
}

/**
 * PageHeader - Componente global reutilizable para encabezados de página
 *
 * Uso:
 * ```tsx
 * <PageHeader
 *   title="Marcas"
 *   description="Gestiona las marcas asociadas a tus productos"
 *   actions={<Button>Nueva marca</Button>}
 * />
 * ```
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
	return (
		<div
			className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}
		>
			<div className="flex flex-col gap-1">
				<h1 className="text-xl font-semibold tracking-tight">{title}</h1>
				{description && <p className="text-muted-foreground text-sm">{description}</p>}
			</div>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</div>
	);
}
