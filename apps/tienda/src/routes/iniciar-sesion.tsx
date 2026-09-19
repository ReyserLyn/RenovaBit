import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { LoginForm } from "@/features/auth/components/login-form";
import { WhatsAppIcon } from "@/shared/components/icons";
import { authSessionQueryOptions } from "@/shared/lib/auth/auth-session";
import { buildWhatsAppUrl } from "@/shared/lib/contact";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
	access_denied: "Inicio de sesión cancelado. Puedes intentar con otro método.",
};

const FORGOT_PASSWORD_URL = buildWhatsAppUrl({
	message: "Hola, olvidé mi contraseña de RenovaBit. ¿Me ayudan a recuperar el acceso?",
});

export const Route = createFileRoute("/iniciar-sesion")({
	validateSearch: (search: Record<string, unknown>): { error?: string } => {
		const error = typeof search.error === "string" ? search.error : undefined;
		return error ? { error } : {};
	},

	beforeLoad: async ({ context }) => {
		const session = await context.queryClient.fetchQuery(authSessionQueryOptions());

		if (session?.user) {
			throw redirect({ to: "/" });
		}
	},
	head: () => ({
		meta: [{ name: "robots", content: "noindex, follow" }],
	}),
	component: LoginPage,
});

function LoginPage() {
	const { error: oauthError } = Route.useSearch();
	const router = useRouter();

	useEffect(() => {
		if (!oauthError) return;

		const message = OAUTH_ERROR_MESSAGES[oauthError] ?? `Error al iniciar sesión: ${oauthError}`;
		toast.error(message);

		router.navigate({ to: "/iniciar-sesion", search: {}, replace: true });
	}, [oauthError, router]);

	return (
		<div className="flex min-h-svh flex-col justify-center lg:grid lg:grid-cols-2">
			<div className="flex items-center justify-center p-6 lg:p-10">
				<div className="w-full max-w-md">
					<LoginForm />

					<div className="mt-5 rounded-lg border border-border bg-muted/30 px-4 py-3 text-center">
						<p className="text-sm font-medium">¿Olvidaste tu contraseña?</p>
						<p className="text-muted-foreground mt-1 text-sm">
							Escríbenos por WhatsApp y te ayudamos a recuperar el acceso a tu cuenta.
						</p>
						<a
							href={FORGOT_PASSWORD_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary mt-2 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2"
						>
							<WhatsAppIcon className="size-4" />
							Escribir por WhatsApp
						</a>
					</div>
				</div>
			</div>

			<div className="relative hidden overflow-hidden lg:block">
				<img
					alt="Fondo de inicio de sesión"
					src="/images/auth/login.avif"
					className="absolute inset-0 size-full object-cover transition-transform duration-700 hover:scale-105"
				/>
				<div className="absolute inset-0 bg-linear-to-tr from-black/60 via-black/30 to-transparent" />
			</div>
		</div>
	);
}
