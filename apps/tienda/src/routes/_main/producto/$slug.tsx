import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { productQueries } from "@/features/products/hooks/queries";
import { isApiClientError } from "@/shared/lib/api";
import { formatPrice } from "@/shared/lib/format";
import { seo } from "@/shared/lib/seo";

export const Route = createFileRoute("/_main/producto/$slug")({
	loader: async ({ params, context: { queryClient } }) => {
		try {
			const product = await queryClient.ensureQueryData(productQueries.bySlug(params.slug));
			return { product };
		} catch (error) {
			if (isApiClientError(error) && error.code === "NOT_FOUND_ERROR") {
				throw notFound();
			}
			throw error;
		}
	},

	head: ({ loaderData }) => {
		if (!loaderData?.product) return {};
		const { product } = loaderData;
		return {
			meta: [
				...seo({
					title: `${product.name} — Comprar online | Renovabit`,
					description:
						product.description?.slice(0, 160) ??
						`Compra ${product.name} al mejor precio en Renovabit. SKU: ${product.sku}. Envíos a todo Perú.`,
				}),
			],
		};
	},

	component: ProductPage,
});

function ProductPage() {
	const { slug } = Route.useParams();
	const { data: product } = useSuspenseQuery(productQueries.bySlug(slug));

	return (
		<div className="flex flex-1 flex-col gap-8 py-6">
			{/* Breadcrumb */}
			<nav className="flex items-center gap-2 text-sm text-muted-foreground">
				<Link to="/" className="hover:text-foreground transition-colors">
					Inicio
				</Link>
				{product.category && (
					<>
						<span>/</span>
						<Link
							to="/categoria/$slug"
							params={{ slug: product.category.slug }}
							className="hover:text-foreground transition-colors"
						>
							{product.category.name}
						</Link>
					</>
				)}
				<span>/</span>
				<span className="text-foreground font-medium">{product.name}</span>
			</nav>

			{/* Layout: Imagen + Info */}
			<div className="grid grid-cols-1 gap-8 md:grid-cols-2">
				{/* Galería de imágenes */}
				<div className="space-y-4">
					{product.images.length > 0 ? (
						<div className="grid grid-cols-2 gap-2">
							{product.images.slice(0, 4).map((img) => (
								<img
									key={img.id}
									src={img.url}
									alt={img.alt ?? product.name}
									className="w-full aspect-square rounded-lg object-cover bg-muted"
								/>
							))}
						</div>
					) : (
						<div className="flex aspect-square items-center justify-center rounded-lg bg-muted text-muted-foreground">
							Sin imagen
						</div>
					)}
				</div>

				{/* Información del producto */}
				<div className="space-y-6">
					{/* Marca */}
					{product.brand && (
						<div className="flex items-center gap-3">
							{product.brand.imageUrl && (
								<img
									src={product.brand.imageUrl}
									alt={product.brand.name}
									className="size-10 rounded-lg object-contain bg-muted"
								/>
							)}
							<Link
								to="/marca/$slug"
								params={{ slug: product.brand.slug }}
								className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
							>
								{product.brand.name}
							</Link>
						</div>
					)}

					{/* Nombre */}
					<h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>

					{/* SKU + Stock */}
					<div className="flex items-center gap-4 text-sm text-muted-foreground">
						<span>SKU: {product.sku}</span>
						<span>Stock: {product.stock}</span>
					</div>

					{/* Precio */}
					<p className="text-4xl font-bold text-foreground">{formatPrice(product.price)}</p>

					{/* Descripción */}
					{product.description && (
						<div className="prose prose-sm max-w-none text-muted-foreground">
							<p>{product.description}</p>
						</div>
					)}
				</div>
			</div>

			{/* Especificaciones técnicas */}
			{product.specifications.length > 0 && (
				<section className="space-y-4">
					<h2 className="text-xl font-semibold tracking-tight">Especificaciones técnicas</h2>
					<div className="divide-y divide-border rounded-lg border border-border">
						{product.specifications.map((spec) => (
							<div
								key={spec.id}
								className="grid grid-cols-2 gap-4 px-4 py-3 text-sm even:bg-muted/30"
							>
								<span className="font-medium text-muted-foreground">{spec.key}</span>
								<span className="text-foreground">{spec.value}</span>
							</div>
						))}
					</div>
				</section>
			)}

			{/* Fecha de creación */}
			<p className="text-xs text-muted-foreground">
				Publicado el{" "}
				{new Date(product.createdAt).toLocaleDateString("es-PE", {
					year: "numeric",
					month: "long",
					day: "numeric",
				})}
			</p>
		</div>
	);
}
