import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalList, LegalPage, LegalSection } from "@/shared/components/legal-page";
import { BUSINESS } from "@/shared/lib/business";
import { getSiteUrl } from "@/shared/lib/env";
import { seo } from "@/shared/lib/seo";

const PATH = "/politicas-de-envio-y-devolucion";
const TITLE = "Políticas de Envío y Devolución";

export const Route = createFileRoute("/_main/politicas-de-envio-y-devolucion")({
	head: () => {
		const url = `${getSiteUrl()}${PATH}`;
		const tags = seo({
			title: `${TITLE} | Renovabit`,
			description:
				"Modalidades y plazos de envío, garantías y procedimiento de cambios o devoluciones conforme al Código de Protección y Defensa del Consumidor.",
			url,
		});
		return {
			meta: [...tags.meta],
			links: [{ rel: "canonical", href: url }, ...tags.links],
		};
	},
	component: ShippingReturnsPage,
});

function ShippingReturnsPage() {
	return (
		<LegalPage
			title={TITLE}
			subtitle="Aplicable a compras realizadas en el sitio y por nuestros canales oficiales de atención."
			updatedAt={BUSINESS.legalUpdated}
		>
			<LegalSection title="1. Modalidad y coordinación de envíos">
				<p>
					La entrega se coordina al confirmar el pedido, con los datos de contacto proporcionados
					por el cliente. Según la ubicación, están disponibles las siguientes modalidades:
				</p>
				<LegalList
					items={[
						"Entrega local coordinada en la ciudad de Arequipa, en el punto y horario que se acuerden.",
						"Envío por agencia de transporte a otras ciudades del país, cuando la cobertura de la agencia lo permita.",
					]}
				/>
				<p>
					Los plazos dependen de la ubicación, la disponibilidad del producto y la coordinación del
					pago; se informan al cliente al confirmar el pedido. El costo de envío se comunica antes
					de concretar el pago y no está incluido en el precio del producto, salvo indicación
					expresa.
				</p>
			</LegalSection>

			<LegalSection title="2. Recepción del pedido">
				<p>
					Al recibir el producto, revísalo y verifica que corresponda a lo solicitado. Si detectas
					una incidencia (producto distinto, dañado o incompleto), comunícalo de inmediato a
					nuestros canales de atención indicando tu número de pedido, para coordinarse la revisión y
					la solución que corresponda.
				</p>
			</LegalSection>

			<LegalSection title="3. Garantía legal">
				<p>
					Los productos cuentan con la garantía legal prevista en el Código de Protección y Defensa
					del Consumidor (Ley N.º 29571). Adicionalmente, cuando el fabricante ofrezca una garantía
					propia, se informará sus condiciones y el canal de atención correspondiente.
				</p>
				<p>
					La garantía no cubre daños ocasionados por uso indebido, instalación incorrecta,
					manipulación por terceros no autorizados o el desgaste normal del producto.
				</p>
			</LegalSection>

			<LegalSection title="4. Cambios y devoluciones">
				<p>
					Conforme a la normativa peruana, no existe un derecho de retracto libre y general para
					compras realizadas por internet. Sin perjuicio de ello, y de la garantía legal, puedes
					solicitar un cambio o devolución cuando:
				</p>
				<LegalList
					items={[
						"El producto entregado no corresponde a lo solicitado.",
						"El producto presenta un defecto de fábrica o llegó dañado.",
						"La compra se realizó mediante un método agresivo o engañoso, supuesto en el que corresponde la restitución conforme al Código de Protección y Defensa del Consumidor.",
					]}
				/>
				<p>
					La solución se define según el caso: reparación, reposición del producto o devolución del
					monto pagado, en coordinación con el consumidor y según disponibilidad. Todo cambio o
					devolución está sujeto a la revisión del producto por nuestro equipo.
				</p>
			</LegalSection>

			<LegalSection title="5. Cómo iniciar un cambio o devolución">
				<LegalList
					items={[
						<>
							Escríbenos por WhatsApp al {BUSINESS.phoneDisplay} o por correo a{" "}
							<a href={`mailto:${BUSINESS.email}`} className="underline underline-offset-2">
								{BUSINESS.email}
							</a>
							.
						</>,
						"Indica tu número de pedido, el producto y el motivo de la solicitud.",
						"Adjunta fotografías o evidencia del producto y, de ser posible, del empaque.",
						"Coordinaremos la revisión y te comunicaremos la solución y los pasos a seguir.",
					]}
				/>
				<p>
					Puedes ver el contacto completo en el pie de página. Nuestro horario de atención es{" "}
					{BUSINESS.schedule}.
				</p>
			</LegalSection>

			<LegalSection title="6. Reclamos">
				<p>
					Si tu solicitud no se atiende o consideras que no fue resuelta correctamente, puedes
					registrar un reclamo o queja en nuestro{" "}
					<Link to="/libro-de-reclamaciones" className="underline underline-offset-2">
						Libro de Reclamaciones virtual
					</Link>{" "}
					o ante INDECOPI.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
