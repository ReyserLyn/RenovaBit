import { applyOfferToProduct } from "@renovabit/pricing";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Card } from "@renovabit/ui/components/ui/card";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import type { Offer, OfferProductDetail } from "../service/offers.service";

// ── Props ──

export interface OfferViewProps {
	offer: Offer;
	products: OfferProductDetail[];
	isProductsPending?: boolean;
	isProductsError?: boolean;
}

// ── Sub-components ──

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-2">
			<span className="text-muted-foreground text-sm shrink-0">{label}</span>
			<div className="font-medium text-sm text-right">{children}</div>
		</div>
	);
}

// ── Image placeholder ──

function ProductImage({
	image,
	name,
}: {
	image: { url: string; alt: string | null } | null;
	name: string;
}) {
	if (!image) {
		return (
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
				<svg
					className="h-5 w-5 text-muted-foreground"
					fill="none"
					viewBox="0 0 24 24"
					strokeWidth={1.5}
					stroke="currentColor"
				>
					<title>{name}</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
					/>
				</svg>
			</div>
		);
	}
	return (
		<img
			src={image.url}
			alt={image.alt ?? name}
			className="h-10 w-10 shrink-0 rounded-md border object-cover"
		/>
	);
}

// ── Component ──

export function OfferView({ offer, products, isProductsPending, isProductsError }: OfferViewProps) {
	return (
		<div className="flex flex-col gap-5">
			{/* ── Offer info card ── */}
			<Card className="p-4">
				<div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
					<div className="min-w-0">
						<h2 className="text-base font-bold truncate">{offer.name}</h2>
						{offer.description && (
							<p className="text-muted-foreground mt-0.5 text-xs leading-relaxed line-clamp-2">
								{offer.description}
							</p>
						)}
					</div>
					<div className="flex shrink-0 gap-1.5">
						{offer.isFeatured && (
							<Badge variant="warning" size="xs">
								Destacada
							</Badge>
						)}
						<Badge variant={offer.isActive ? "success" : "secondary"} size="xs">
							{offer.isActive ? "Activa" : "Inactiva"}
						</Badge>
					</div>
				</div>

				<div className="grid gap-2 sm:grid-cols-2">
					<DetailRow label="Slug">
						<span className="font-mono text-xs">{offer.slug}</span>
					</DetailRow>
					<DetailRow label="Descuento">{`${offer.discountValue}%`}</DetailRow>
					<DetailRow label="Productos">{products.length}</DetailRow>
					{offer.startsAt && (
						<DetailRow label="Inicio">{new Date(offer.startsAt).toLocaleDateString()}</DetailRow>
					)}
					{offer.endsAt && (
						<DetailRow label="Fin">{new Date(offer.endsAt).toLocaleDateString()}</DetailRow>
					)}
				</div>
			</Card>

			{/* ── Products ── */}
			<Card className="p-4">
				<h3 className="mb-3 font-medium text-foreground text-sm">
					Productos asignados ({products.length})
				</h3>
				{isProductsError ? (
					<p className="text-destructive py-2 text-sm">Error al cargar los productos.</p>
				) : isProductsPending ? (
					<div className="space-y-2">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				) : products.length === 0 ? (
					<p className="text-muted-foreground py-2 text-sm">
						No hay productos asignados a esta oferta.
					</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-border border-b text-left">
									<th className="pb-2 pr-2 font-medium text-muted-foreground text-xs w-12" />
									<th className="pb-2 pr-2 font-medium text-muted-foreground text-xs">Producto</th>
									<th className="pb-2 pr-2 font-medium text-muted-foreground text-xs">Precio</th>
								</tr>
							</thead>
							<tbody>
								{products.map((p) => {
									const { discountedPrice, totalDiscount } = applyOfferToProduct(Number(p.price), [
										{ discountValue: Number(offer.discountValue) },
									]);
									const hasDiscount = totalDiscount > 0;
									return (
										<tr key={p.productId} className="border-border border-b last:border-0">
											<td className="py-1.5 pr-2 align-middle">
												<ProductImage image={p.primaryImage} name={p.name} />
											</td>
											<td className="py-1.5 pr-2 align-middle">
												<div className="flex flex-col">
													<span className="font-medium text-sm truncate max-w-[200px]">
														{p.name}
													</span>
													<span className="text-muted-foreground text-xs font-mono">{p.sku}</span>
												</div>
											</td>
											<td className="py-1.5 text-right align-middle tabular-nums">
												<div className="flex flex-col items-end gap-0.5">
													{hasDiscount ? (
														<>
															<span className="text-muted-foreground text-xs line-through">
																S/ {p.price}
															</span>
															<span className="font-semibold text-sm">
																S/ {discountedPrice.toFixed(2)}
															</span>
															<Badge variant="success" size="xs">
																{`${offer.discountValue}%`}
															</Badge>
														</>
													) : (
														<span className="font-medium text-sm">S/ {p.price}</span>
													)}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</Card>
		</div>
	);
}
