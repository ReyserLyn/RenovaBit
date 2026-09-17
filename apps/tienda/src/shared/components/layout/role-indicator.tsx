import { Shield01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { useCartSsr } from "@/shared/lib/stores/cart-ssr-context";

type SpecialRole = "admin";

const ROLE_META: Record<
	SpecialRole,
	{ label: string; icon: typeof Shield01Icon; variant: "invert-light" }
> = {
	admin: { label: "Administrador", icon: Shield01Icon, variant: "invert-light" },
};

export function RoleIndicator() {
	const { session } = useCartSsr();
	const role = session?.user?.role;
	if (role !== "admin") return null;

	const meta = ROLE_META[role];
	const Icon = meta.icon;

	return (
		<Badge variant={meta.variant} size="sm" radius="full" aria-label={`Rol activo: ${meta.label}`}>
			<HugeiconsIcon icon={Icon} size={12} strokeWidth={1.5} />
			{meta.label}
		</Badge>
	);
}
