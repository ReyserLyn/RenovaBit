import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { authClient } from "@/shared/lib/auth/auth-client";
import { getAuthMessage } from "@/shared/lib/auth/auth-error-messages";
import { authKeys, resetAuthState } from "@/shared/lib/auth/auth-session";

export function useLogout() {
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationKey: [...authKeys.all, "logout"],
		mutationFn: async () => {
			await authClient.signOut();
			await resetAuthState(queryClient);
		},
		onSuccess: () => {
			toast.success("Has cerrado sesión correctamente");
			void router.invalidate();
			void navigate({ to: "/login" });
		},
		onError: (error: Error) => {
			toast.error(getAuthMessage(error));
		},
	});

	return {
		...mutation,
		logout: mutation.mutateAsync,
		isLoggingOut: mutation.isPending,
	};
}
