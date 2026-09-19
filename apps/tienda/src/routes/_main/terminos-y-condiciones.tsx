import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalList, LegalPage, LegalSection } from "@/shared/components/legal-page";
import { BUSINESS } from "@/shared/lib/business";
import { getSiteUrl } from "@/shared/lib/env";
import { seo } from "@/shared/lib/seo";

const PATH = "/terminos-y-condiciones";
const TITLE = "Términos y Condiciones";

export const Route = createFileRoute("/_main/terminos-y-condiciones")({
	head: () => {
		const url = `${getSiteUrl()}${PATH}`;
		const tags = seo({
			title: `${TITLE} | Renovabit`,
			description:
				"Términos y condiciones de compra en Renovabit: proveedor, precios en soles, métodos de pago, proceso de pedido, envíos, garantías y reclamos.",
			url,
		});
		return {
			meta: [...tags.meta],
			links: [{ rel: "canonical", href: url }, ...tags.links],
		};
	},
	component: TermsPage,
});

function TermsPage() {
	return (
		<LegalPage
			title={TITLE}
			subtitle="Condiciones aplicables al uso de la tienda y a la compra de productos, conforme al Código de Protección y Defensa del Consumidor (Ley N.º 29571)."
			updatedAt={BUSINESS.legalUpdated}
		>
			<LegalSection title="1. Identificación del proveedor">
				<p>
					<strong>Titular:</strong> {BUSINESS.legalName}, {BUSINESS.titularType}, RUC {BUSINESS.ruc}
					, con domicilio en {BUSINESS.domicilio}. Correo:{" "}
					<a href={`mailto:${BUSINESS.email}`} className="underline underline-offset-2">
						{BUSINESS.email}
					</a>
					.
				</p>
				<p>
					La tienda es operada comercialmente como <strong>{BUSINESS.tradeName}</strong>. Canales de
					atención: teléfono {BUSINESS.phoneDisplay}, horario {BUSINESS.schedule}.
				</p>
			</LegalSection>

			<LegalSection title="2. Aceptación de los términos">
				<p>
					Al navegar por el sitio, crear una cuenta o realizar un pedido, aceptas estos términos y
					nuestras políticas de privacidad, envíos y devoluciones. Si no estás de acuerdo, te
					pedimos no completar la compra.
				</p>
			</LegalSection>

			<LegalSection title="3. Productos e información publicada">
				<LegalList
					items={[
						"Las imágenes son referenciales y pueden presentar variaciones de presentación o empaque respecto al producto entregado.",
						"Las especificaciones se basan en la información disponible y publicada por el fabricante.",
						"El stock y los precios están sujetos a variación sin previo aviso; el pedido se confirma según disponibilidad al momento de la validación.",
					]}
				/>
			</LegalSection>

			<LegalSection title="4. Precios y comprobantes de pago">
				<p>
					Los precios publicados se expresan en soles (S/). Cuando el producto esté afecto al IGV,
					el precio mostrado ya lo incluye. Los precios no incluyen el costo de envío, salvo que se
					indique expresamente lo contrario. Emitimos boleta o factura electrónica según
					corresponda, conforme al régimen tributario del titular.
				</p>
			</LegalSection>

			<LegalSection title="5. Métodos de pago">
				<p>Aceptamos los siguientes métodos, coordinados al confirmar el pedido:</p>
				<LegalList
					items={[
						"Yape.",
						"Plin.",
						"Transferencia o depósito bancario.",
						"Efectivo, según coordinación previa y cobertura disponible.",
					]}
				/>
				<p>
					Para pedidos de productos se abona el 50% del total al confirmar el pedido; el 50%
					restante se paga al recibir la entrega. El pedido se considera confirmado cuando el abono
					inicial es acreditado y validado por Renovabit.
				</p>
				<p>
					No solicitamos claves, códigos de tarjeta ni datos bancarios completos por canales
					distintos a los oficiales publicados en este sitio.
				</p>
			</LegalSection>

			<LegalSection title="6. Proceso de pedido y confirmación">
				<LegalList
					items={[
						"Registras tu pedido en la tienda o por WhatsApp e indicas tus datos de contacto y el método de pago elegido.",
						"El pedido queda en estado pendiente mientras validamos stock y coordinamos el abono inicial.",
						"Confirmado el abono inicial, el pedido pasa a estado confirmado y se coordina la entrega.",
						"Si no hay stock o el abono no se concreta en el plazo coordinado, el pedido puede cancelarse sin penalidad para el consumidor.",
					]}
				/>
				<p>
					La confirmación se comunica por WhatsApp o al correo registrado. Para pedidos como
					invitado, conserva tu número de pedido: es la referencia de atención.
				</p>
			</LegalSection>

			<LegalSection title="7. Envíos">
				<p>
					Los plazos, la cobertura y la modalidad de entrega se detallan en nuestra{" "}
					<Link to="/politicas-de-envio-y-devolucion" className="underline underline-offset-2">
						Política de Envíos y Devoluciones
					</Link>
					. La entrega se coordina con el cliente a través de los datos de contacto proporcionados.
				</p>
			</LegalSection>

			<LegalSection title="8. Garantías">
				<p>
					Los productos cuentan con la garantía legal que corresponde conforme al Código de
					Protección y Defensa del Consumidor, sin perjuicio de la garantía del fabricante cuando se
					indique. Las condiciones y el procedimiento están descritos en la{" "}
					<Link to="/politicas-de-envio-y-devolucion" className="underline underline-offset-2">
						Política de Envíos y Devoluciones
					</Link>
					.
				</p>
			</LegalSection>

			<LegalSection title="9. Reclamos">
				<p>
					Contamos con un Libro de Reclamaciones virtual, disponible de forma permanente en{" "}
					<Link to="/libro-de-reclamaciones" className="underline underline-offset-2">
						esta página
					</Link>
					. También puedes escribirnos a{" "}
					<a href={`mailto:${BUSINESS.email}`} className="underline underline-offset-2">
						{BUSINESS.email}
					</a>{" "}
					o llamarnos al {BUSINESS.phoneDisplay}.
				</p>
			</LegalSection>

			<LegalSection title="10. Uso del sitio y propiedad intelectual">
				<p>
					El contenido del sitio (marcas, textos, imágenes y diseño) se encuentra protegido por la
					normativa aplicable. No está permitido su uso comercial sin autorización, ni el uso del
					sitio para actividades ilícitas o que afecten a terceros.
				</p>
			</LegalSection>

			<LegalSection title="11. Ley aplicable">
				<p>
					Estos términos se rigen por la legislación peruana. Cualquier controversia puede ser
					atendida ante las autoridades de protección al consumidor (INDECOPI) o ante los juzgados
					competentes, sin perjuicio de los canales de atención directa que ofrecemos.
				</p>
			</LegalSection>

			<LegalSection title="12. Modificaciones">
				<p>
					Podemos actualizar estos términos para reflejar cambios normativos u operativos. La
					versión vigente se publica en esta página con su fecha de actualización; los pedidos ya
					confirmados se rigen por los términos vigentes al momento de su compra.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
