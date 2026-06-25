/**
 * Mock data para la home v1 — solo marcas por ahora.
 * Las categorías, ofertas y productos destacados ya consumen data real
 * de la API. Este archivo se elimina cuando `brands-section` se conecte
 * al endpoint real de marcas.
 */
export interface MockBrand {
	id: string;
	slug: string;
	name: string;
}

export const MOCK_BRANDS: MockBrand[] = [
	{ id: "1", slug: "msi", name: "MSI" },
	{ id: "2", slug: "hp", name: "HP" },
	{ id: "3", slug: "dell", name: "Dell" },
	{ id: "4", slug: "lenovo", name: "Lenovo" },
	{ id: "5", slug: "asus", name: "Asus" },
	{ id: "6", slug: "logitech", name: "Logitech" },
];
