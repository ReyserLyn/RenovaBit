import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

export const Route = createFileRoute("/_authenticated/lista-negra")({
	component: () => <AdminPlaceholderPage title="SKUs bloqueados" />,
});
