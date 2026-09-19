import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notificationKeys } from "@/features/notifications/hooks/notification-queries";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import { syncReportsService } from "../service/sync-reports.service";
import { syncReportKeys } from "./sync-reports-queries";

// ── Mutations ──────────────────────────────────────────

export function useRunSync() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (limit?: number) => syncReportsService.run(limit),
		onSuccess: (result) => {
			toast.success(result.message);
			queryClient.invalidateQueries({ queryKey: syncReportKeys.all });
			// El worker crea la notificación al terminar; refrescar la lista global.
			queryClient.invalidateQueries({ queryKey: notificationKeys.all });
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}
