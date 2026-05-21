"use client";

import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@renovabit/ui/components/ui/input-group";
import * as React from "react";

type PasswordInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "type">;

function PasswordInput({ disabled, ...props }: PasswordInputProps) {
	const [showPassword, setShowPassword] = React.useState(false);

	return (
		<InputGroup>
			<InputGroupInput
				type={showPassword ? "text" : "password"}
				className="hide-password-toggle"
				disabled={disabled}
				{...props}
			/>
			<InputGroupAddon align="inline-end">
				<InputGroupButton
					size="icon-xs"
					className="hover:bg-transparent!"
					onClick={() => setShowPassword((prev) => !prev)}
					disabled={disabled}
					aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
				>
					{showPassword ? (
						<HugeiconsIcon icon={ViewIcon} color="currentColor" aria-hidden />
					) : (
						<HugeiconsIcon icon={ViewOffIcon} color="currentColor" aria-hidden />
					)}
				</InputGroupButton>
			</InputGroupAddon>
		</InputGroup>
	);
}
PasswordInput.displayName = "PasswordInput";

export type { PasswordInputProps };
export { PasswordInput };
