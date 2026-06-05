import { createFileRoute, redirect } from "@tanstack/react-router";
import { RegisterStepper } from "@/features/auth/components/register-stepper";
import { authSessionQueryOptions } from "@/shared/lib/auth/auth-session";

export const Route = createFileRoute("/registrarse")({
	beforeLoad: async ({ context }) => {
		const session = await context.queryClient.fetchQuery(authSessionQueryOptions());
		if (session?.user) throw redirect({ to: "/" });
	},
	component: RegisterPage,
});

function RegisterPage() {
	return (
		<div className="flex min-h-svh flex-col justify-center lg:grid lg:grid-cols-2">
			<div className="relative hidden overflow-hidden lg:block">
				<img
					alt="Fondo de registro"
					src="/images/auth/login.avif"
					className="absolute inset-0 size-full object-cover transition-transform duration-700 hover:scale-105"
				/>
				<div className="absolute inset-0 bg-linear-to-tl from-black/60 via-black/30 to-transparent" />
			</div>

			<div className="flex items-center justify-center p-6 lg:p-10">
				<div className="w-full max-w-md">
					<RegisterStepper />
				</div>
			</div>
		</div>
	);
}
