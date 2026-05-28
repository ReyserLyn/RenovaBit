import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

function CuponesPage() {
	return <AdminPlaceholderPage title="Cupones" />;
}

export const Route = createFileRoute("/_authenticated/cupones")({
	component: CuponesPage,
});
