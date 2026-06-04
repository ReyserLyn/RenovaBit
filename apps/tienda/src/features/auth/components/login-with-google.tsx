import { Button } from "@renovabit/ui/components/ui/button";
import { GoogleIcon } from "@/shared/components/icons/google-icon";
import { authClient } from "@/shared/lib/auth/auth-client";

export function LoginWithGoogle() {
	const origin = typeof window !== "undefined" ? window.location.origin : "";

	const handleSignIn = async () => {
		await authClient.signIn.social({
			provider: "google",
			callbackURL: `${origin}/`,
			errorCallbackURL: `${origin}/iniciar-sesion`,
		});
	};

	return (
		<Button
			className="w-full bg-white text-foreground hover:bg-muted border border-input"
			onClick={handleSignIn}
			type="button"
			variant="outline"
			size="lg"
		>
			<GoogleIcon className="size-5" />
			Continuar con Google
		</Button>
	);
}
