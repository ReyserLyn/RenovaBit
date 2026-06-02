export const SITE = {
	name: "RenovaBit",
	url: "https://renovabit.com",
	description:
		"Servicio técnico de laptops y PCs en Arequipa. Reparación, mantenimiento y soporte remoto.",
	author: "RenovaBit",
	locale: "es_PE",
	ogImage: "/og-default.png",
} as const;

export const CONTACT = {
	whatsappUrl: "https://wa.me/51987471074",
	phone: "+51 987 471 074",
} as const;

export const NAV_ITEMS = [
	{ href: "/", label: "Inicio" },
	{ href: "/#servicios", label: "Servicios" },
	{ href: "/tienda", label: "Tienda" },
] as const;
