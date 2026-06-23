import { Shield01Icon, Store01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { useCartSsr } from "@/shared/lib/stores/cart-ssr-context";

type Role = "admin" | "customer" | "distributor";

const ROLE_META: Record<
	Role,
	{ label: string; icon: typeof Shield01Icon; variant: "invert-light" | "info-light" | "secondary" }
> = {
	admin: { label: "Administrador", icon: Shield01Icon, variant: "invert-light" },
	distributor: { label: "Distribuidor", icon: Store01Icon, variant: "info-light" },
	customer: { label: "Cliente", icon: UserIcon, variant: "secondary" },
};

export function RoleIndicator() {
	const { session } = useCartSsr();
	const role = session?.user?.role;
	if (!role) return null;

	const meta = ROLE_META[role];
	if (!meta) return null;
	const Icon = meta.icon;

	return (
		<Badge variant={meta.variant} size="sm" radius="full" aria-label={`Rol activo: ${meta.label}`}>
			<HugeiconsIcon icon={Icon} size={12} strokeWidth={1.5} />
			{meta.label}
		</Badge>
	);
}
