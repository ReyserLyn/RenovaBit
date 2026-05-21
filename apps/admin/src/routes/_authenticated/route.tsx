import { buttonVariants } from "@renovabit/ui/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@renovabit/ui/components/ui/sidebar";
import { cn } from "@renovabit/ui/lib/utils";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import { authClient } from "@/shared/lib/auth/auth-client";
import { authSessionQueryOptions, resetAuthState } from "@/shared/lib/auth/auth-session";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async ({ context }) => {
		const session = await context.queryClient.fetchQuery(authSessionQueryOptions());

		if (!session) {
			throw redirect({ to: "/login" });
		}

		if (session.user?.role !== "admin") {
			await authClient.signOut();
			await resetAuthState(context.queryClient);
			throw redirect({ to: "/login" });
		}

		return { session };
	},
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	const { session } = Route.useRouteContext();

	return (
		<SidebarProvider>
			<a
				href="#admin-main"
				className={cn(
					buttonVariants({ variant: "default", size: "sm" }),
					"sr-only shadow focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50",
				)}
			>
				Saltar al contenido
			</a>

			<AppSidebar user={session.user} />

			<SidebarInset>
				<header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-background/80 px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
					<SidebarTrigger className="-ms-1" />
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-foreground text-sm font-medium leading-none">
							Panel de tienda
						</span>
						<span className="text-muted-foreground truncate text-xs leading-none">
							Pedidos, catálogo, clientes y marketing
						</span>
					</div>
				</header>

				<main id="admin-main" className="flex flex-1 flex-col gap-4 p-4" tabIndex={-1}>
					<Outlet />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
