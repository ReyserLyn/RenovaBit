import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import { complaintsService, type RespondComplaintValues } from "../service/complaints.service";
import { complaintKeys } from "./complaints-queries";

// ── Mutations ──────────────────────────────────────────

export function useRespondToComplaint() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: RespondComplaintValues }) =>
			complaintsService.respond(id, data),
		onSuccess: (_data, { id }) => {
			queryClient.invalidateQueries({ queryKey: complaintKeys.lists() });
			queryClient.invalidateQueries({ queryKey: complaintKeys.detail(id) });
			toast.success("Respuesta registrada correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}
