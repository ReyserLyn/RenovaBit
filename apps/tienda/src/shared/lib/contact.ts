/**
 * Datos de contacto centralizados de la tienda.
 * Cambiar aquí propaga a todos los CTAs de WhatsApp.
 */

/** Número en formato internacional sin "+" (para wa.me). */
export const WHATSAPP_NUMBER = "51987471074";

/** Display format para mostrar al usuario. */
export const WHATSAPP_DISPLAY = "+51 987 471 074";

interface BuildWaOpts {
	message: string;
}

/** Construye un link wa.me con mensaje pre-rellenado. */
export function buildWhatsAppUrl({ message }: BuildWaOpts): string {
	const params = new URLSearchParams({ text: message });
	return `https://wa.me/${WHATSAPP_NUMBER}?${params.toString()}`;
}

/** Mensaje plantilla para un pedido. */
export function orderWhatsAppMessage(opts: {
	orderNumber: string;
	total: string;
	customerName?: string | null;
}): string {
	const greeting = opts.customerName ? `Hola, soy ${opts.customerName}. ` : "Hola, ";
	return `${greeting}Acabo de realizar el pedido ${opts.orderNumber} por ${opts.total}. ¿Me ayudan con el pago y envío?`;
}
