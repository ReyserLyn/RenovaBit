import { Loading02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@renovabit/ui/lib/utils";

function Spinner({
	className,
	strokeWidth,
	...props
}: React.ComponentProps<"svg"> & { strokeWidth?: number }) {
	return (
		<HugeiconsIcon
			icon={Loading02Icon}
			color="currentColor"
			role="status"
			aria-label="Loading"
			strokeWidth={strokeWidth}
			className={cn("size-4 animate-spin", className)}
			{...props}
		/>
	);
}

export { Spinner };
