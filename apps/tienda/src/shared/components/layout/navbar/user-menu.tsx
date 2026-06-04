import {
	FavouriteIcon,
	Logout01Icon,
	ShoppingBag01Icon,
	UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@renovabit/ui/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@renovabit/ui/components/ui/dropdown-menu";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { authClient } from "@/shared/lib/auth/auth-client";
import { getAuthMessage } from "@/shared/lib/auth/auth-error-messages";
import { authSessionQueryOptions, invalidateAuthQueries } from "@/shared/lib/auth/auth-session";
import { ButtonAuth } from "./button-auth";

function getUserInitials(
	name: string | null | undefined,
	email: string | null | undefined,
): string {
	if (name) {
		return name.charAt(0).toUpperCase();
	}
	if (email) {
		return email.charAt(0).toUpperCase();
	}
	return "?";
}

export function UserMenu() {
	const { data: session } = useSuspenseQuery(authSessionQueryOptions());
	const router = useRouter();
	const queryClient = useQueryClient();

	if (!session?.user) {
		return <ButtonAuth />;
	}

	const user = session.user;
	const initials = getUserInitials(user.name, user.email);

	const handleSignOut = async () => {
		try {
			await authClient.signOut();
			await invalidateAuthQueries(queryClient);
			void router.invalidate();
			toast.success("Sesión cerrada correctamente");
		} catch (error) {
			toast.error(getAuthMessage(error as Error));
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className="rounded-full size-8 hover:bg-accent/50 transition-colors hover:cursor-pointer"
				aria-label="Menú de usuario"
			>
				<Avatar>
					{user.image ? (
						<AvatarImage src={user.image} alt={user.name ?? ""} />
					) : (
						<AvatarFallback>{initials}</AvatarFallback>
					)}
				</Avatar>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuGroup>
					<DropdownMenuLabel>
						<div className="flex flex-col gap-0.5">
							<span className="text-foreground text-sm font-medium truncate">
								{user.name ?? user.username ?? "Usuario"}
							</span>
							<span className="text-muted-foreground text-xs font-normal truncate">
								{user.email}
							</span>
						</div>
					</DropdownMenuLabel>
				</DropdownMenuGroup>

				<DropdownMenuSeparator />

				<DropdownMenuItem
					render={
						<Link to="/mi-cuenta">
							<HugeiconsIcon icon={UserIcon} className="size-4" />
							Mi perfil
						</Link>
					}
				/>

				<DropdownMenuItem
					render={
						<Link to="/mis-pedidos">
							<HugeiconsIcon icon={ShoppingBag01Icon} className="size-4" />
							Mis pedidos
						</Link>
					}
				/>

				<DropdownMenuItem
					render={
						<Link to="/favoritos">
							<HugeiconsIcon icon={FavouriteIcon} className="size-4" />
							Favoritos
						</Link>
					}
				/>

				<DropdownMenuSeparator />

				<DropdownMenuItem variant="destructive" onClick={handleSignOut}>
					<HugeiconsIcon icon={Logout01Icon} className="size-4" />
					Cerrar sesión
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
