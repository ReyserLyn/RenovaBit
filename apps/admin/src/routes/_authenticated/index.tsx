import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@renovabit/ui/components/ui/card";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
	component: DashboardHome,
});

function DashboardHome() {
	const { session } = Route.useRouteContext();
	const user = session.user;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Resumen de la tienda</CardTitle>
				<CardDescription>
					Usa el menú lateral para pedidos, catálogo, clientes y promociones.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-2 text-sm">
				{user.name ? (
					<p>
						<strong>Nombre:</strong> <span className="wrap-break-word">{user.name}</span>
					</p>
				) : null}
				{user.email ? (
					<p className="min-w-0">
						<strong>Correo:</strong> <span className="wrap-break-word">{user.email}</span>
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
