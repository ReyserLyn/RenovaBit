import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@renovabit/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
	"group/badge relative inline-flex w-fit shrink-0 items-center justify-center gap-1 border border-transparent font-medium whitespace-nowrap outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
				outline:
					"border-border bg-transparent dark:bg-input/32 [a]:hover:bg-muted [a]:hover:text-muted-foreground",
				secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
				info: "bg-info text-white",
				success: "bg-success text-white",
				warning: "bg-warning text-white",
				destructive: "bg-destructive text-white [a]:hover:bg-destructive/90",
				invert: "bg-invert text-invert-foreground",
				"primary-light":
					"border-none bg-primary/10 text-primary dark:bg-primary/20 [a]:hover:bg-primary/15 dark:[a]:hover:bg-primary/25",
				"warning-light":
					"border-none bg-warning/10 text-warning-foreground dark:bg-warning/20 [a]:hover:bg-warning/15 dark:[a]:hover:bg-warning/25",
				"success-light":
					"border-none bg-success/10 text-success-foreground dark:bg-success/20 [a]:hover:bg-success/15 dark:[a]:hover:bg-success/25",
				"info-light":
					"border-none bg-info/10 text-info-foreground dark:bg-info/20 [a]:hover:bg-info/15 dark:[a]:hover:bg-info/25",
				"destructive-light":
					"border-none bg-destructive/10 text-destructive-subtle-foreground dark:bg-destructive/20 [a]:hover:bg-destructive/15 dark:[a]:hover:bg-destructive/25",
				"invert-light":
					"border-none bg-invert/10 text-foreground dark:bg-invert/20 [a]:hover:bg-invert/15 dark:[a]:hover:bg-invert/25",
				"primary-outline":
					"border-border bg-background text-primary dark:bg-input/30 [a]:hover:bg-muted",
				"warning-outline":
					"border-border bg-background text-warning-foreground dark:bg-input/30 [a]:hover:bg-muted",
				"success-outline":
					"border-border bg-background text-success-foreground dark:bg-input/30 [a]:hover:bg-muted",
				"info-outline":
					"border-border bg-background text-info-foreground dark:bg-input/30 [a]:hover:bg-muted",
				"destructive-outline":
					"border-border bg-background text-destructive-subtle-foreground dark:bg-input/30 [a]:hover:bg-muted",
				"invert-outline":
					"border-border bg-background text-invert-foreground dark:bg-input/30 [a]:hover:bg-muted",
			},
			size: {
				xs: "h-4 min-w-4 gap-1 px-1 py-0.25 text-[0.6rem] leading-none",
				sm: "h-4.5 min-w-4.5 gap-1 px-1 py-0.25 text-[0.625rem] leading-none",
				default: "h-5 min-w-5 gap-1 px-1.25 py-0.5 text-xs",
				lg: "h-5.5 min-w-5.5 gap-1 px-1.5 py-0.5 text-xs",
				xl: "h-6 min-w-6 gap-1.5 px-2 py-0.75 text-sm",
			},
			radius: {
				default: "rounded-sm",
				full: "rounded-full",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
			radius: "default",
		},
	},
);

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
