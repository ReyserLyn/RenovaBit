import { Setting06Icon, Shield01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { getSessionServerFn } from "@/shared/lib/auth/auth-session";

export const Route = createFileRoute("/_main/mi-cuenta")({
	loader: async () => {
		const session = await getSessionServerFn();

		if (!session?.user) {
			throw redirect({ to: "/iniciar-sesion" });
		}

		return { user: session.user };
	},
	component: MiCuentaLayout,
});

// ── Sidebar link config ────────────────────────────

interface NavItem {
	to: "/mi-cuenta" | "/mi-cuenta/seguridad" | "/mi-cuenta/configuracion";
	label: string;
	icon: typeof UserIcon;
}

const navItems: NavItem[] = [
	{ to: "/mi-cuenta", label: "Perfil", icon: UserIcon },
	{ to: "/mi-cuenta/seguridad", label: "Seguridad", icon: Shield01Icon },
	{ to: "/mi-cuenta/configuracion", label: "Configuración", icon: Setting06Icon },
];

// ── Layout component ───────────────────────────────

function MiCuentaLayout() {
	return (
		<div className="flex flex-col md:flex-row gap-8 container mx-auto py-8 px-4">
			{/* Sidebar */}
			<aside className="w-full md:w-56 shrink-0">
				<nav className="flex md:flex-col gap-1" aria-label="Navegación de cuenta">
					{navItems.map((item) => (
						<Link
							key={item.to}
							to={item.to}
							activeOptions={{ exact: item.to === "/mi-cuenta" ? true : undefined }}
							activeProps={{ className: "bg-muted font-medium border-l-2 border-foreground" }}
							className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors border-l-2 border-transparent"
						>
							<HugeiconsIcon icon={item.icon} className="size-4 shrink-0" />
							{item.label}
						</Link>
					))}
				</nav>
			</aside>

			{/* Content area */}
			<main className="flex-1 min-w-0">
				<Outlet />
			</main>
		</div>
	);
}
