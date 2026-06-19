export const SITE = {
	name: "RenovaBit",
	url: "https://renovabit.com",
	description:
		"Servicio técnico de laptops y PCs en Arequipa. Reparación, mantenimiento y soporte remoto.",
	author: "RenovaBit",
	locale: "es_PE",
	ogImage: "/og-default.png",
} as const;

/**
 * URL canónica de la tienda. Se resuelve en build time desde `PUBLIC_STORE_URL`
 * (definila en `apps/landing/.env` para dev local: `PUBLIC_STORE_URL=http://localhost:3003`).
 * En deploy de prod, el build command debe setearla o se usa el fallback.
 */
export const STORE_URL = import.meta.env.PUBLIC_STORE_URL ?? "https://tienda.renovabit.com";

export const CONTACT = {
	whatsappUrl: "https://wa.me/51987471074",
	phone: "+51 987 471 074",
	email: "contacto@renovabit.com",
} as const;

export const SOCIAL = {
	instagram: "https://instagram.com/renovabit",
	facebook: "https://facebook.com/renovabit",
	tiktok: "https://tiktok.com/@renovabit",
} as const;

export const NAV_ITEMS = [
	{ href: "/", label: "Inicio" },
	{ href: "/#servicios", label: "Servicios" },
	{ href: STORE_URL, label: "Tienda" },
] as const;

/** Detecta links cross-origin (cross-app) en NAV_ITEMS para tratarlos como externos. */
export const isExternalHref = (href: string): boolean => /^https?:\/\//i.test(href);
