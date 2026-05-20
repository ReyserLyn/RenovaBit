"use client";

import { useTheme } from "better-themes";
import type { SVGProps } from "react";
import { useEffect, useState } from "react";
import { LogoHorizontalDark } from "./logo-horizontal-dark";
import { LogoHorizontalLight } from "./logo-horizontal-light";

export type LogoVariant = "light" | "dark" | "auto";

export interface LogoHorizontalProps extends SVGProps<SVGSVGElement> {
	variant?: LogoVariant;
}

export function LogoHorizontal({ variant = "auto", ...props }: LogoHorizontalProps) {
	const { theme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (variant !== "auto") {
		return variant === "dark" ? (
			<LogoHorizontalDark {...props} />
		) : (
			<LogoHorizontalLight {...props} />
		);
	}

	if (!mounted) {
		return <LogoHorizontalLight {...props} />;
	}

	const currentTheme = theme ?? "light";
	return currentTheme === "dark" ? (
		<LogoHorizontalDark {...props} />
	) : (
		<LogoHorizontalLight {...props} />
	);
}
