import { createFileRoute } from "@tanstack/react-router";
import { UserTable } from "@/features/users/components/user-table";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/usuarios")({
	component: UsuariosPage,
});

function UsuariosPage() {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Usuarios"
				description="Consulta los usuarios registrados, sus roles y estado de verificación."
			/>

			<UserTable />
		</div>
	);
}
