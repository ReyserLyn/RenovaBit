import { SidebarProvider } from "@renovabit/ui/components/ui/sidebar";
import { useIsMobile } from "@renovabit/ui/hooks/use-mobile";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { brandQueries } from "@/features/brands/hooks/queries";
import { categoryQueries } from "@/features/categories/hooks/queries";
import Footer from "@/shared/components/layout/footer";
import Navbar from "@/shared/components/layout/navbar";
import { AppSidebar } from "@/shared/components/layout/sidebar/app-sidebar";
import { authSessionQueryOptions } from "@/shared/lib/auth/auth-session";

export const Route = createFileRoute("/_main")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData(categoryQueries.tree()),
			queryClient.ensureQueryData(brandQueries.list()),
		]);
	},

	component: RouteComponent,
});

function RouteComponent() {
	const isMobile = useIsMobile();

	return (
		<SidebarProvider>
			{isMobile && <AppSidebar />}

			<div className="flex flex-1 flex-col">
				<div className="container mx-auto flex w-full flex-1 flex-col overflow-x-hidden">
					<Navbar />

					<main className="flex flex-1 flex-col">
						<Outlet />
					</main>
				</div>

				<Footer />
			</div>
		</SidebarProvider>
	);
}
