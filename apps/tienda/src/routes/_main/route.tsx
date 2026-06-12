import { SidebarProvider } from "@renovabit/ui/components/ui/sidebar";
import { useIsMobile } from "@renovabit/ui/hooks/use-mobile";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { brandQueries } from "@/features/brands/hooks/queries";
import { cartQueries } from "@/features/cart/hooks/queries";
import { getCartTotalServerFn } from "@/features/cart/hooks/server";
import { categoryQueries } from "@/features/categories/hooks/queries";
import Footer from "@/shared/components/layout/footer";
import Navbar from "@/shared/components/layout/navbar";
import { AppSidebar } from "@/shared/components/layout/sidebar/app-sidebar";
import { authSessionQueryOptions } from "@/shared/lib/auth/auth-session";
import { CartSsrProvider } from "@/shared/lib/stores/cart-ssr-context";

export const Route = createFileRoute("/_main")({
	loader: async ({ context: { queryClient } }) => {
		const [session] = await Promise.all([
			queryClient.fetchQuery(authSessionQueryOptions()),
			queryClient.ensureQueryData(categoryQueries.tree()),
			queryClient.ensureQueryData(brandQueries.list()),
		]);

		let cartTotal: { itemsCount: number; subtotal: string } | null = null;
		if (session?.user) {
			const total = await getCartTotalServerFn();
			cartTotal = total ?? { itemsCount: 0, subtotal: "0" };
			queryClient.setQueryData(cartQueries.total(null).queryKey, cartTotal);
		}

		return { preloadedSession: session, preloadedCartTotal: cartTotal };
	},

	component: RouteComponent,
});

function RouteComponent() {
	const { preloadedSession, preloadedCartTotal } = Route.useLoaderData();
	const isMobile = useIsMobile();

	return (
		<SidebarProvider>
			{isMobile && <AppSidebar />}

			<div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
				<div className="container mx-auto flex w-full flex-1 flex-col overflow-x-hidden min-h-svh">
					<CartSsrProvider value={{ session: preloadedSession, cartTotal: preloadedCartTotal }}>
						<Navbar />
					</CartSsrProvider>

					<main className="flex min-w-0 flex-1 flex-col">
						<Outlet />
					</main>
				</div>

				<Footer />
			</div>
		</SidebarProvider>
	);
}
