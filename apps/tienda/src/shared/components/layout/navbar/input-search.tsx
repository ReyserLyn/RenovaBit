import { ArrowRight01Icon, Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@renovabit/ui/components/ui/input-group";
import { Kbd } from "@renovabit/ui/components/ui/kbd";
import { cn } from "@renovabit/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import hotkeys from "hotkeys-js";
import { useEffect, useId, useRef, useState } from "react";

type InputSearchProps = {
	placeholder?: string;
	className?: string;
};

export default function InputSearch({
	placeholder = "Buscar productos...",
	className,
}: InputSearchProps) {
	const id = useId();
	const navigate = useNavigate();
	const [value, setValue] = useState("");
	const [modKey, setModKey] = useState("Ctrl");
	const inputRef = useRef<HTMLInputElement>(null);

	// Detectar SO para mostrar Ctrl (Windows/Linux) o ⌘ (Mac)
	useEffect(() => {
		if (navigator.platform.includes("Mac")) {
			setModKey("⌘");
		}
	}, []);

	// Ctrl+K / Cmd+K para enfocar la búsqueda
	useEffect(() => {
		hotkeys("ctrl+k, command+k", (event) => {
			event.preventDefault();
			inputRef.current?.focus();
		});

		return () => {
			hotkeys.unbind("ctrl+k, command+k");
		};
	}, []);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		const query = value.trim();
		if (!query) return;

		navigate({ to: "/buscar", search: { q: query } });
	};

	return (
		<form onSubmit={handleSearch} className={cn("w-full max-w-sm", className)}>
			<InputGroup className="h-10 bg-muted/50 border-transparent hover:bg-muted focus-within:bg-background transition-all duration-200">
				<InputGroupAddon className="text-muted-foreground group-focus-within/input-group:text-primary transition-colors duration-200">
					<HugeiconsIcon icon={Search01Icon} size={18} />
				</InputGroupAddon>

				<InputGroupInput
					ref={inputRef}
					id={id}
					type="text"
					placeholder={placeholder}
					value={value}
					onChange={(e) => setValue(e.target.value)}
					className="h-full"
				/>

				<InputGroupAddon align="inline-end" className="gap-1">
					{value && (
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							onClick={() => setValue("")}
							aria-label="Limpiar búsqueda"
						>
							<HugeiconsIcon icon={Cancel01Icon} size={14} />
						</Button>
					)}

					{!value && (
						<div className="hidden sm:flex items-center gap-1 opacity-60">
							<Kbd>{modKey}</Kbd>
							<Kbd>K</Kbd>
						</div>
					)}

					{value && <div className="w-px h-4 bg-border mx-0.5" />}

					<InputGroupButton
						type="submit"
						size="icon-sm"
						variant={value ? "default" : "ghost"}
						aria-label="Buscar"
						disabled={!value}
					>
						<HugeiconsIcon icon={ArrowRight01Icon} size={18} />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</form>
	);
}
