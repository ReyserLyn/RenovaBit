import { createFileRoute } from "@tanstack/react-router";
import { LegalList, LegalPage, LegalSection } from "@/shared/components/legal-page";
import { BUSINESS } from "@/shared/lib/business";
import { getSiteUrl } from "@/shared/lib/env";
import { seo } from "@/shared/lib/seo";

const PATH = "/politica-de-privacidad";
const TITLE = "Política de Privacidad";

export const Route = createFileRoute("/_main/politica-de-privacidad")({
	head: () => {
		const url = `${getSiteUrl()}${PATH}`;
		const tags = seo({
			title: `${TITLE} | Renovabit`,
			description:
				"Conoce cómo Renovabit trata tus datos personales, con qué finalidad, por cuánto tiempo y cómo ejercer tus derechos ARCO.",
			url,
		});
		return {
			meta: [...tags.meta],
			links: [{ rel: "canonical", href: url }, ...tags.links],
		};
	},
	component: PrivacyPage,
});

function PrivacyPage() {
	return (
		<LegalPage
			title={TITLE}
			subtitle="Tratamiento de datos personales conforme a la Ley N.º 29733, Ley de Protección de Datos Personales, y su Reglamento aprobado por D.S. N.º 016-2024-JUS."
			updatedAt={BUSINESS.legalUpdated}
		>
			<LegalSection title="1. Responsable del tratamiento">
				<p>
					El responsable del tratamiento de tus datos personales es{" "}
					<strong>{BUSINESS.legalName}</strong>, {BUSINESS.titularType} que opera comercialmente
					como <strong>{BUSINESS.tradeName}</strong> (RUC {BUSINESS.ruc}).
				</p>
				<p>
					Domicilio de atención: {BUSINESS.domicilio}. Para consultas sobre esta política o sobre
					tus datos personales puedes escribirnos a{" "}
					<a href={`mailto:${BUSINESS.email}`} className="underline underline-offset-2">
						{BUSINESS.email}
					</a>{" "}
					o llamarnos al {BUSINESS.phoneDisplay} en el horario {BUSINESS.schedule}.
				</p>
			</LegalSection>

			<LegalSection title="2. Finalidad del tratamiento">
				<p>Tus datos se tratan para las siguientes finalidades:</p>
				<LegalList
					items={[
						"Crear y administrar tu cuenta en la tienda.",
						"Registrar, procesar y dar seguimiento a tus pedidos.",
						"Coordinar el pago, la entrega y la atención posventa.",
						"Atender consultas, reclamos y solicitudes de garantía.",
						"Prevenir fraudes y mantener la seguridad de la plataforma.",
						"Cumplir obligaciones legales, contables y tributarias aplicables.",
					]}
				/>
				<p>
					No utilizamos tus datos para finalidades distintas a las informadas ni los vendemos a
					terceros. Podemos encargar su tratamiento a proveedores que prestan servicios necesarios
					(hospedaje, mensajería, procesamiento de pagos), bajo obligaciones de confidencialidad y
					solo por el tiempo necesario.
				</p>
			</LegalSection>

			<LegalSection title="3. Datos que recolectamos">
				<LegalList
					items={[
						"Datos de cuenta: nombre, apellido, nombre de usuario, correo electrónico y teléfono.",
						"Datos de pedido: nombre de contacto, teléfono, dirección o referencia de entrega, productos, notas y método de pago elegido.",
						"Datos técnicos: identificadores de sesión y de carrito invitado, dirección IP y datos básicos de navegación necesarios para el funcionamiento del sitio.",
					]}
				/>
				<p>
					No almacenamos números completos de tarjetas ni credenciales financieras: los pagos se
					coordinan por los canales indicados en el sitio y se procesan fuera de nuestra plataforma.
				</p>
			</LegalSection>

			<LegalSection title="4. Conservación de los datos">
				<p>
					Conservamos tus datos mientras mantengas una relación con nosotros y, luego, durante los
					plazos exigidos por la normativa aplicable (por ejemplo, obligaciones contables y de
					protección al consumidor). Cumplidos esos plazos, los datos se eliminan o se anonimizan de
					forma segura.
				</p>
			</LegalSection>

			<LegalSection title="5. Tus derechos (ARCO)">
				<p>
					Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición, así como
					los demás reconocidos por la Ley N.º 29733, escribiendo a{" "}
					<a href={`mailto:${BUSINESS.email}`} className="underline underline-offset-2">
						{BUSINESS.email}
					</a>{" "}
					e indicando tu nombre, el derecho que deseas ejercer y un documento que acredite tu
					identidad.
				</p>
				<p>
					Atenderemos tu solicitud en un plazo máximo de quince (15) días hábiles. Si consideras que
					no atendimos correctamente tu pedido, puedes acudir a la Autoridad Nacional de Protección
					de Datos Personales del Ministerio de Justicia y Derechos Humanos.
				</p>
			</LegalSection>

			<LegalSection title="6. Seguridad de la información">
				<p>
					Aplicamos medidas técnicas y organizativas razonables para proteger tus datos contra
					accesos no autorizados, pérdida o alteración. Ningún sistema es completamente infalible,
					por lo que te recomendamos cuidar tus credenciales y cerrar sesión en equipos compartidos.
				</p>
			</LegalSection>

			<LegalSection title="7. Cookies y almacenamiento local">
				<p>
					Usamos almacenamiento local y cookies propias necesarias para mantener tu sesión, tu
					carrito y tus preferencias. No usamos estos mecanismos para publicidad de terceros. Puedes
					borrarlos desde la configuración de tu navegador, aunque algunas funciones podrían dejar
					de estar disponibles.
				</p>
			</LegalSection>

			<LegalSection title="8. Cambios en esta política">
				<p>
					Podemos actualizar esta política para reflejar cambios normativos u operativos. La versión
					vigente estará siempre publicada en esta página con su fecha de actualización.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
