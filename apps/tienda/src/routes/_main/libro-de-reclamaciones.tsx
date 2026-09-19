import { createFileRoute } from "@tanstack/react-router";
import { ComplaintForm } from "@/features/complaints/components/complaint-form";
import { LegalList, LegalPage, LegalSection } from "@/shared/components/legal-page";
import { BUSINESS } from "@/shared/lib/business";
import { getSiteUrl } from "@/shared/lib/env";
import { seo } from "@/shared/lib/seo";

const PATH = "/libro-de-reclamaciones";
const TITLE = "Libro de Reclamaciones";

export const Route = createFileRoute("/_main/libro-de-reclamaciones")({
	head: () => {
		const url = `${getSiteUrl()}${PATH}`;
		const tags = seo({
			title: `${TITLE} virtual | Renovabit`,
			description:
				"Registra tu reclamo o queja en el Libro de Reclamaciones virtual de Renovabit, conforme al Código de Protección y Defensa del Consumidor.",
			url,
		});
		return {
			meta: [...tags.meta],
			links: [{ rel: "canonical", href: url }, ...tags.links],
		};
	},
	component: ComplaintBookPage,
});

function ComplaintBookPage() {
	return (
		<LegalPage
			title={TITLE}
			subtitle="Conforme al artículo 150 de la Ley N.º 29571, Código de Protección y Defensa del Consumidor, y su Reglamento del Libro de Reclamaciones (D.S. N.º 011-2011-PCM, modificado por el D.S. N.º 101-2022-PCM)."
			updatedAt={BUSINESS.legalUpdated}
		>
			<LegalSection title="Información importante">
				<LegalList
					items={[
						<>
							<strong>Reclamo:</strong> exiges la corrección de un producto o servicio (por ejemplo,
							un producto defectuoso, distinto al solicitado o una demora que te afecta).
						</>,
						<>
							<strong>Queja:</strong> manifiestas malestar respecto a la atención recibida, sin
							cuestionar el producto o servicio.
						</>,
						"Renovabit dará respuesta a tu hoja en un plazo máximo de quince (15) días hábiles improrrogables, mediante comunicación escrita al correo electrónico que indiques.",
						"La atención de tu reclamo no puede ser condicionada al pago previo del producto o servicio materia de la reclamación.",
						"Si no quedas conforme con la respuesta, puedes acudir a INDECOPI a través de su plataforma Reclama Virtual (www.consumidor.gob.pe) o a las autoridades competentes.",
					]}
				/>
				<p>
					El responsable de atender tu hoja es <strong>{BUSINESS.legalName}</strong>,{" "}
					{BUSINESS.titularType}, RUC {BUSINESS.ruc}, con domicilio en {BUSINESS.domicilio},
					operando comercialmente como <strong>{BUSINESS.tradeName}</strong>. Correo de contacto:{" "}
					<a href={`mailto:${BUSINESS.email}`} className="underline underline-offset-2">
						{BUSINESS.email}
					</a>
					.
				</p>
			</LegalSection>

			<LegalSection title="Registrar tu reclamo o queja">
				<ComplaintForm />
			</LegalSection>
		</LegalPage>
	);
}
