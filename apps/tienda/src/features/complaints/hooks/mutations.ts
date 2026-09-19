import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError, api, unwrapResponse } from "@/shared/lib/api";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";

export type CreateComplaintInput = Parameters<typeof api.api.v1.complaints.post>[0];

export function useCreateComplaint() {
	return useMutation({
		mutationFn: (data: CreateComplaintInput) => unwrapResponse(api.api.v1.complaints.post(data)),
		onError: (error) => {
			if (error instanceof ApiClientError && error.code === "RATE_LIMITED") {
				toast.error("Demasiadas solicitudes", {
					description: "Espera un minuto e inténtalo de nuevo.",
				});
				return;
			}
			toast.error(resolveErrorMessage(error));
		},
	});
}
