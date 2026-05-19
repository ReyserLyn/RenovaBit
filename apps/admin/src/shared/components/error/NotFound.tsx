import { Alert02Icon, Home01Icon } from "@hugeicons/core-free-icons";
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
import { Link, useRouter } from "@tanstack/react-router";

export function NotFound() {
	const router = useRouter();

	return (
		<div className="container flex min-h-svh flex-col items-center justify-center p-4">
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
							<p className="text-muted-foreground font-mono text-xs font-medium tracking-widest uppercase">
								404
							</p>
							<CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
								Página no encontrada
							</CardTitle>
							<CardDescription className="text-pretty text-muted-foreground/90">
								La ruta que buscas no existe o fue movida. Vuelve atrás o regresa al resumen del
								panel.
							</CardDescription>
						</div>
					</CardHeader>
					<CardFooter className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
						<Button
							type="button"
							variant="outline"
							className="w-full sm:w-auto"
							onClick={() => {
								router.history.back();
							}}
						>
							Volver atrás
						</Button>
						<Link to="/" className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto")}>
							<HugeiconsIcon icon={Home01Icon} color="currentColor" data-icon="inline-start" />
							Ir al resumen
						</Link>
					</CardFooter>
				</Card>
			</div>
		</div>
	);
}
