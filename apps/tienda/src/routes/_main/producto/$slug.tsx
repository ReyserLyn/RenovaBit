import { ShoppingCartIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Label } from "@renovabit/ui/components/ui/label";
import { cn } from "@renovabit/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { RelatedProducts } from "@/features/products/components/related-products";
import { productQueries } from "@/features/products/hooks/queries";
import { FavoriteButton } from "@/shared/components/favorites/favorite-button";
import { WhatsAppIcon } from "@/shared/components/icons";
import {
	NumberField,
	NumberFieldDecrement,
	NumberFieldGroup,
	NumberFieldIncrement,
	NumberFieldInput,
} from "@/shared/components/ui/number-field";
import { isApiClientError } from "@/shared/lib/api";
import { getSiteUrl } from "@/shared/lib/env";
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

	const inStock = product.stock > 0;
	const stockLabel = inStock ? `Stock: ${product.stock}` : "Agotado";
	const stockColor = !inStock
		? "text-destructive"
		: product.stock <= 5
			? "text-warning"
			: "text-success";

	const productUrl =
		typeof window !== "undefined"
			? window.location.href
			: `${getSiteUrl()}/producto/${product.slug}`;
	const whatsappMessage = encodeURIComponent(
		`Hola, me interesa "${product.name}" (SKU: ${product.sku}) - ${formatPrice(product.price)}\n\n${productUrl}`,
	);

	return (
		<div className="flex flex-1 flex-col gap-8 py-6">
			{/* ── Breadcrumb ──────────────────────── */}
			<nav className="animate-fade-in flex items-center gap-2 text-sm text-muted-foreground">
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
				{product.brand && (
					<>
						<span>/</span>
						<Link
							to="/marca/$slug"
							params={{ slug: product.brand.slug }}
							className="hover:text-foreground transition-colors"
						>
							{product.brand.name}
						</Link>
					</>
				)}
				<span>/</span>
				<span className="font-medium truncate max-w-[200px]">{product.name}</span>
			</nav>

			{/* ── Content ─────────────────────────── */}
			<div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
				{/* ── Imagen ─────────────────────────── */}
				<div className="animate-fade-in-up animate-duration-normal lg:w-1/2">
					<div className="sticky top-6 aspect-square overflow-hidden rounded-2xl bg-[#f1f1f7]">
						{product.images.length > 0 ? (
							<img
								src={product.images[0]?.url}
								alt={product.images[0]?.alt ?? product.name}
								loading="eager"
								decoding="async"
								className="h-full w-full object-contain p-6"
							/>
						) : (
							<div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
								Sin imagen
							</div>
						)}

						{/* Favorito */}
						<FavoriteButton
							slug={product.slug}
							className="absolute right-3 top-3 z-10 size-9"
							size={20}
						/>
					</div>
				</div>

				{/* ── Info ───────────────────────────── */}
				<div className="animate-fade-in-up animate-duration-normal flex flex-col gap-6 lg:w-1/2">
					{/* Marca + Categoría + SKU */}
					<div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
						{product.brand && (
							<div className="flex items-center gap-1.5">
								<span className="text-muted-foreground text-[0.7rem] uppercase tracking-wider">
									Marca
								</span>
								<Link
									to="/marca/$slug"
									params={{ slug: product.brand.slug }}
									className="hover:text-foreground transition-colors font-medium"
								>
									{product.brand.name}
								</Link>
							</div>
						)}
						{product.category && (
							<div className="flex items-center gap-1.5">
								<span className="text-muted-foreground text-[0.7rem] uppercase tracking-wider">
									Categoría
								</span>
								<Link
									to="/categoria/$slug"
									params={{ slug: product.category.slug }}
									className="hover:text-foreground transition-colors"
								>
									{product.category.name}
								</Link>
							</div>
						)}
						<div className="flex items-center gap-1.5">
							<span className="text-muted-foreground text-[0.7rem] uppercase tracking-wider">
								SKU
							</span>
							<span>{product.sku}</span>
						</div>
					</div>

					{/* Nombre */}
					<h1 className="text-2xl font-bold tracking-tight md:text-3xl">{product.name}</h1>

					{/* Precio + Stock */}
					<div className="flex items-baseline gap-4">
						<p className="text-4xl font-bold tracking-tight">{formatPrice(product.price)}</p>
						<span className={cn("text-sm font-medium", stockColor)}>{stockLabel}</span>
					</div>

					{/* Separador */}
					<hr className="border-border" />

					{/* Cantidad */}
					<div className="space-y-1.5">
						<Label htmlFor="product-qty">Cantidad</Label>
						<NumberField
							id="product-qty"
							defaultValue={1}
							min={1}
							max={product.stock}
							disabled={!inStock}
						>
							<NumberFieldGroup className="w-32">
								<NumberFieldDecrement />
								<NumberFieldInput />
								<NumberFieldIncrement />
							</NumberFieldGroup>
						</NumberField>
					</div>

					{/* ── Botones de acción ───── */}
					<div className="flex flex-col gap-3 sm:flex-row">
						<Button size="xl" className="sm:flex-1" disabled={!inStock}>
							<HugeiconsIcon icon={ShoppingCartIcon} size={20} />
							{inStock ? "Añadir al carrito" : "Agotado"}
						</Button>

						<Button
							nativeButton={false}
							size="xl"
							className="sm:flex-1 border-[#25D366] bg-[#25D366] text-white hover:bg-[#25D366]/90 hover:text-white"
							render={
								<a
									href={`https://wa.me/51987471074?text=${whatsappMessage}`}
									target="_blank"
									rel="noopener noreferrer"
								>
									<WhatsAppIcon className="size-5" />
									Comprar por WhatsApp
								</a>
							}
						/>
					</div>

					{/* Descripción */}
					{product.description && (
						<div className="space-y-2">
							<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
								Descripción
							</h2>
							<p className="text-pretty text-sm leading-relaxed text-foreground/85">
								{product.description}
							</p>
						</div>
					)}

					{/* Especificaciones */}
					{product.specifications.length > 0 && (
						<div className="space-y-2">
							<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
								Especificaciones técnicas
							</h2>
							<div className="divide-y divide-border rounded-lg border border-border">
								{product.specifications.map((spec) => (
									<div
										key={spec.id}
										className="grid grid-cols-2 gap-4 px-4 py-2.5 text-sm even:bg-muted/30"
									>
										<span className="font-medium text-muted-foreground">{spec.key}</span>
										<span>{spec.value}</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Notas legales */}
					<div className="space-y-1 rounded-lg border border-border bg-muted/30 px-4 py-3">
						<p className="text-[0.7rem] leading-relaxed text-muted-foreground/70">
							* Imagen de referencia
						</p>
						<p className="text-[0.7rem] leading-relaxed text-muted-foreground/70">
							* Precio incluye IGV.
						</p>
						<p className="text-[0.7rem] leading-relaxed text-muted-foreground/70">
							* Precio no incluye flete por envío.
						</p>
						<p className="text-[0.7rem] leading-relaxed text-muted-foreground/70">
							* El precio y stock están sujetos a variación sin previo aviso.
						</p>
						<p className="text-[0.7rem] leading-relaxed text-muted-foreground/70">
							* Las especificaciones están basadas con toda la información disponible y publicada
							por el fabricante.
						</p>
					</div>
				</div>
			</div>

			{/* ── Productos Relacionados ───────────── */}
			{product.category && (
				<div className="animate-fade-in-up">
					<RelatedProducts currentSlug={product.slug} categorySlug={product.category.slug} />
				</div>
			)}
		</div>
	);
}
