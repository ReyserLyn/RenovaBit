"use client";

import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Input, type InputProps } from "@renovabit/ui/components/ui/input";
import { cn } from "@renovabit/ui/lib/utils";
import * as React from "react";

type PasswordInputProps = Omit<InputProps, "type">;

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
	{ className, disabled, ...props },
	ref,
) {
	const [showPassword, setShowPassword] = React.useState(false);

	return (
		<div className="relative w-full min-w-0">
			<Input
				type={showPassword ? "text" : "password"}
				className={cn("hide-password-toggle pe-9", className)}
				ref={ref}
				disabled={disabled}
				{...props}
			/>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="absolute inset-e-0 top-0 h-full rounded-l-none px-2.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
				onClick={() => setShowPassword((prev) => !prev)}
				disabled={disabled}
				aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
			>
				{showPassword ? (
					<HugeiconsIcon icon={ViewIcon} color="currentColor" aria-hidden />
				) : (
					<HugeiconsIcon icon={ViewOffIcon} color="currentColor" aria-hidden />
				)}
			</Button>
		</div>
	);
});
PasswordInput.displayName = "PasswordInput";

export type { PasswordInputProps };
export { PasswordInput };
