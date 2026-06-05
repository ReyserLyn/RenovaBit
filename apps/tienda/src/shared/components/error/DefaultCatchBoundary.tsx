import { Alert02Icon, Home01Icon, ReloadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, buttonVariants } from "@renovabit/ui/components/ui/button";
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@renovabit/ui/components/ui/card";
import { cn } from "@renovabit/ui/lib/utils";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";

/**
 * Error boundary global — captura errores en loaders y componentes.
 *
 * - Nunca muestra el error crudo al usuario (ni message, ni stack).
 * - En desarrollo se loggea a consola para debugging.
 * - En producción se podría enviar a un servicio de monitoreo.
 */
export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
	const router = useRouter();
	const isRoot = useMatch({
		strict: false,
		select: (state) => state.id === rootRouteId,
	});

	// ⚠️  Solo loggeo en desarrollo. En producción enviar a servicio de monitoreo.
	if (import.meta.env.DEV) {
		console.error("[DefaultCatchBoundary]", error);
	}

	return (
		<div className="container flex h-full flex-col items-center justify-center p-4">
			<div className="w-full max-w-md">
				<Card className="border-border/70 bg-card/95 shadow-xl transition-shadow duration-200">
					<CardHeader className="flex flex-col items-center gap-4 pb-2 text-center">
						<div
							className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl"
							aria-hidden
						>
							<HugeiconsIcon icon={Alert02Icon} color="currentColor" />
						</div>
						<div className="flex flex-col gap-2">
							<CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
								Algo salió mal
							</CardTitle>
							<CardDescription className="text-pretty text-muted-foreground/90">
								Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
							</CardDescription>
						</div>
					</CardHeader>
					<CardFooter className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
						<Button
							type="button"
							variant="outline"
							className="w-full sm:w-auto"
							onClick={() => {
								router.invalidate();
							}}
						>
							<HugeiconsIcon icon={ReloadIcon} color="currentColor" data-icon="inline-start" />
							Reintentar
						</Button>
						<Link to="/" className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto")}>
							<HugeiconsIcon icon={Home01Icon} color="currentColor" data-icon="inline-start" />
							{isRoot ? "Inicio" : "Volver al inicio"}
						</Link>
					</CardFooter>
				</Card>
			</div>
		</div>
	);
}
