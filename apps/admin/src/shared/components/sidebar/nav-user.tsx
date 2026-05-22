import { ArrowDown01Icon, Logout01Icon } from "@hugeicons/core-free-icons";
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
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@renovabit/ui/components/ui/sidebar";
import { cn } from "@renovabit/ui/lib/utils";
import { useState } from "react";
import { useUserDisplay } from "@/features/auth/hooks/use-user-display";
import { LogoutDialog } from "@/shared/components/dialog/logout-dialog";
import { AnimatedThemeToggler } from "@/shared/components/layout/theme-toggle";
import { User } from "@/shared/lib/auth/auth-client";

type NavUserProps = {
	user: User;
};

export function NavUser({ user }: NavUserProps) {
	const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
	const { isMobile } = useSidebar();
	const { displayName, showEmailSecondary, avatarFallback, email } = useUserDisplay(user);

	return (
		<>
			<SidebarMenu>
				<SidebarMenuItem>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<SidebarMenuButton
									size="lg"
									className="group data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
								>
									<Avatar className="size-8 rounded-lg">
										<AvatarImage src={user.image ?? undefined} alt={displayName} />
										<AvatarFallback className="rounded-lg text-xs font-medium">
											{avatarFallback}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{displayName}</span>
										{showEmailSecondary ? (
											<span className="truncate text-xs text-muted-foreground">{email}</span>
										) : null}
									</div>
									<HugeiconsIcon
										icon={ArrowDown01Icon}
										className={cn(
											"ml-auto transition-transform duration-200",
											isMobile
												? "group-data-popup-open:rotate-180"
												: "group-data-popup-open:-rotate-90",
										)}
									/>
								</SidebarMenuButton>
							}
						/>
						<DropdownMenuContent
							className="min-w-56 rounded-lg"
							side={isMobile ? "bottom" : "right"}
							align="end"
							sideOffset={4}
						>
							<DropdownMenuGroup>
								<DropdownMenuLabel className="sr-only">Cuenta</DropdownMenuLabel>

								<AnimatedThemeToggler
									variant="circle"
									className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground [&_svg]:size-4"
								>
									Tema
								</AnimatedThemeToggler>

								<DropdownMenuSeparator />

								<DropdownMenuItem
									className="hover:cursor-pointer"
									variant="destructive"
									onClick={() => setIsLogoutDialogOpen(true)}
								>
									<HugeiconsIcon icon={Logout01Icon} color="currentColor" />
									Cerrar sesión
								</DropdownMenuItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</SidebarMenuItem>
			</SidebarMenu>

			<LogoutDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen} />
		</>
	);
}
