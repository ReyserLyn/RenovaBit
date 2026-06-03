import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { badgeVariants } from "@renovabit/ui/lib/badge-variants";
import { cn } from "@renovabit/ui/lib/utils";
import { type VariantProps } from "class-variance-authority";

type BadgeProps = useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({
	className,
	variant = "default",
	size = "default",
	radius = "default",
	render,
	...props
}: BadgeProps) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				className: cn(badgeVariants({ variant, size, radius }), className),
			},
			props,
		),
		render,
		state: {
			slot: "badge",
			variant,
		},
	});
}

export { Badge, type BadgeProps, badgeVariants };
