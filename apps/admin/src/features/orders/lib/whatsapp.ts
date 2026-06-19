/**
 * Build a WhatsApp message template for contacting a customer about their order.
 */
export function buildWhatsAppMessage(orderNumber: string): string {
	return `Hola, te escribo acerca de tu pedido *${orderNumber}* en RenovaBit. ¿Podemos coordinar el pago y la entrega?`;
}
