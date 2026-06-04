import { Login01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Link } from "@tanstack/react-router";

export function ButtonAuth() {
	return (
		<Button
			nativeButton={false}
			render={
				<Link to="/iniciar-sesion">
					<span className="hidden items-center gap-2 md:flex">
						<HugeiconsIcon icon={Login01Icon} />
						Iniciar Sesión
					</span>

					<span className="flex md:hidden">
						<span className="sr-only">Iniciar Sesión</span>
						<HugeiconsIcon icon={Login01Icon} />
					</span>
				</Link>
			}
		/>
	);
}
