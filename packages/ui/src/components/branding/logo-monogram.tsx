"use client";

import { useTheme } from "better-themes";
import type { SVGProps } from "react";
import { useEffect, useState } from "react";
import type { LogoVariant } from "./logo-horizontal";
import { LogoMonogramDark } from "./logo-monogram-dark";
import { LogoMonogramLight } from "./logo-monogram-light";

export interface LogoMonogramProps extends SVGProps<SVGSVGElement> {
	variant?: LogoVariant;
}

export function LogoMonogram({ variant = "auto", ...props }: LogoMonogramProps) {
	const { theme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (variant !== "auto") {
		return variant === "dark" ? <LogoMonogramDark {...props} /> : <LogoMonogramLight {...props} />;
	}

	if (!mounted) {
		return <LogoMonogramLight {...props} />;
	}

	const currentTheme = theme ?? "light";
	return currentTheme === "dark" ? (
		<LogoMonogramDark {...props} />
	) : (
		<LogoMonogramLight {...props} />
	);
}
