import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
	return (
		<div className="flex min-h-svh">
			<main className="flex-1 p-6">
				<Outlet />
			</main>
		</div>
	);
}
