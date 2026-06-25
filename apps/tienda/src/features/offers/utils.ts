import type { ProductListItem } from "@/features/products/types";
import type { OfferWithProducts } from "./types";

type OfferProduct = OfferWithProducts["products"]["items"][number];

/**
 * Mapea un producto del API de offers al shape que espera `ProductCard`.
 *
 * Si `isEnded=true` (tab abierto después de que la offer terminó), dropea el
 * `offerPrice` y `discountPercent` para que el card muestre el precio base
 * sin descuento.
 */
export function mapOfferProductForCard(product: OfferProduct, isEnded: boolean): ProductListItem {
	return {
		id: product.id,
		name: product.name,
		slug: product.slug,
		price: product.basePrice ?? "0",
		offerPrice: isEnded ? null : product.offerPrice,
		discountPercent: isEnded ? 0 : product.discountPercent,
		stock: product.stock,
		sku: product.sku,
		primaryImage: product.primaryImage ? { url: product.primaryImage, alt: null } : null,
		brand: product.brand ?? null,
	};
}
