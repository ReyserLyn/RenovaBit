import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@renovabit/ui/components/ui/card";
import { Switch } from "@renovabit/ui/components/ui/switch";
import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "better-themes";
import { useEffect, useState } from "react";

// ── Route ─────────────────────────────────────────

export const Route = createFileRoute("/_main/mi-cuenta/configuracion")({
	component: ConfiguracionPage,
});

// ── Page component ─────────────────────────────────

function ConfiguracionPage() {
	const { theme, setTheme } = useTheme();
	const [isDark, setIsDark] = useState(theme === "dark");

	// Sync internal state with external theme changes
	useEffect(() => {
		setIsDark(theme === "dark");
	}, [theme]);

	const handleToggle = (checked: boolean) => {
		setIsDark(checked);
		setTheme(checked ? "dark" : "light");
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
				<p className="text-muted-foreground text-sm mt-1">
					Personaliza tu experiencia en la tienda.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Apariencia</CardTitle>
					<CardDescription>Elige entre el tema claro y oscuro para la interfaz.</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<HugeiconsIcon
								icon={isDark ? Moon02Icon : Sun01Icon}
								className="size-5 text-muted-foreground"
							/>
							<div className="space-y-0.5">
								<p className="text-sm font-medium">Tema {isDark ? "oscuro" : "claro"}</p>
								<p className="text-muted-foreground text-xs">
									{isDark
										? "Modo oscuro activado. Ideal para entornos con poca luz."
										: "Modo claro activado. Ideal para entornos iluminados."}
								</p>
							</div>
						</div>
						<Switch
							checked={isDark}
							onCheckedChange={handleToggle}
							aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
