import { createFileRoute, Outlet } from "@tanstack/react-router";
import { brandQueries } from "@/features/brands/hooks/queries";
import { categoryQueries } from "@/features/categories/hooks/queries";
import Navbar from "@/shared/components/layout/navbar";

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
	return (
		<div className="container flex min-h-svh flex-col">
			<Navbar />

			<main className="mx-auto flex flex-1 flex-col">
				<Outlet />
			</main>
		</div>
	);
}
