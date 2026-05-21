type AdminPlaceholderPageProps = {
	title: string;
};

/** Pantalla temporal hasta que exista la feature real en el panel. */
export function AdminPlaceholderPage({ title }: AdminPlaceholderPageProps) {
	return (
		<div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-6 py-10 text-center">
			<h1 className="text-lg font-semibold tracking-tight">{title}</h1>
			<p className="text-muted-foreground mt-2 text-sm">
				Esta sección se conectará al backend cuando avance el módulo.
			</p>
		</div>
	);
}
