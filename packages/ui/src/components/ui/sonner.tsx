"use client";

import {
	Alert02Icon,
	CancelCircleIcon,
	CheckmarkCircle02Icon,
	InformationCircleIcon,
	Loading02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			theme="light"
			className="toaster group"
			icons={{
				success: <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />,
				info: <HugeiconsIcon icon={InformationCircleIcon} className="size-4" />,
				warning: <HugeiconsIcon icon={Alert02Icon} className="size-4" />,
				error: <HugeiconsIcon icon={CancelCircleIcon} className="size-4" />,
				loading: <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />,
			}}
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					"--border-radius": "var(--radius)",
				} as React.CSSProperties
			}
			toastOptions={{
				classNames: {
					toast: "cn-toast",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
