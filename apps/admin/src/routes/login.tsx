import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginForm } from "@/features/auth/components/login-form";
import { authClient } from "@/shared/lib/auth/auth-client";
import { authSessionQueryOptions, resetAuthState } from "@/shared/lib/auth/auth-session";

export const Route = createFileRoute("/login")({
	beforeLoad: async ({ context }) => {
		const session = await context.queryClient.fetchQuery(authSessionQueryOptions());

		if (session?.user?.role === "admin") {
			throw redirect({ to: "/" });
		}

		if (session) {
			await authClient.signOut();
			await resetAuthState(context.queryClient);
		}
	},
	component: LoginPage,
});

function LoginPage() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center p-4">
			<div className="w-full max-w-md">
				<LoginForm />
			</div>
		</div>
	);
}
