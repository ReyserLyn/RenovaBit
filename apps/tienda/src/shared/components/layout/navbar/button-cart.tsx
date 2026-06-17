import { ShoppingCartIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@renovabit/ui/components/ui/sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CartDrawerContent } from "@/features/cart/components/cart-drawer";
import { useMergeCart } from "@/features/cart/hooks/mutations";
import { type CartResponse, cartKeys, cartQueries } from "@/features/cart/hooks/queries";
import { authSessionQueryOptions } from "@/shared/lib/auth/auth-session";
import { formatPrice } from "@/shared/lib/format";
import { useCartSsr } from "@/shared/lib/stores/cart-ssr-context";
import { useGuestTokenStore } from "@/shared/lib/stores/guest-token";

const EMPTY_CART: CartResponse = {
	id: "",
	guestToken: null,
	items: [],
	itemsCount: 0,
	subtotal: "0",
	lastActivityAt: "",
};

export default function ButtonCart() {
	const guestToken = useGuestTokenStore((s) => s.guestToken);
	const setGuestToken = useGuestTokenStore((s) => s.setGuestToken);
	const ssr = useCartSsr();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	const mergeAttemptedToken = useRef<string | null>(null);
	const mergeCart = useMergeCart();

	useEffect(() => {
		setMounted(true);
	}, []);

	const queryClient = useQueryClient();

	const { data: session } = useQuery({
		...authSessionQueryOptions(),
		initialData: ssr.session ?? undefined,
	});

	const isLoggedIn = !!session?.user;
	const activeGuestToken = isLoggedIn ? null : guestToken;
	const hasGuestToken = !!guestToken;

	const shouldFetchTotal = isLoggedIn || (mounted && !!activeGuestToken);

	const { data: total } = useQuery({
		...cartQueries.total(activeGuestToken),
		enabled: shouldFetchTotal,
		// SSR seed solo para sesión autenticada.
		// En guest NO usar initialData: con staleTime puede congelar contador en 0.
		initialData: isLoggedIn ? (ssr.cartTotal ?? undefined) : undefined,
	});

	const { data: cart, isLoading: isCartLoading } = useQuery({
		...cartQueries.detail(activeGuestToken),
		enabled: mounted && drawerOpen && (isLoggedIn || !!activeGuestToken),
		initialData: !isLoggedIn && !hasGuestToken ? EMPTY_CART : undefined,
	});

	// Reset cart queries when user logs out
	useEffect(() => {
		if (!isLoggedIn && !hasGuestToken) {
			queryClient.resetQueries({ queryKey: cartKeys.all });
		}
	}, [isLoggedIn, hasGuestToken, queryClient]);

	useEffect(() => {
		if (!cart?.guestToken) return;
		if (cart.guestToken !== guestToken) {
			setGuestToken(cart.guestToken);
		}
	}, [cart?.guestToken, guestToken, setGuestToken]);

	useEffect(() => {
		if (!session?.user || !guestToken) return;
		if (mergeAttemptedToken.current === guestToken) return;
		mergeAttemptedToken.current = guestToken;
		mergeCart.mutate(guestToken);
	}, [session?.user?.id, guestToken, mergeCart]);

	const itemCount = total?.itemsCount ?? 0;
	const displayCount = itemCount > 99 ? "99+" : itemCount.toString();
	const hasItems = itemCount > 0;
	const subtotal = total?.subtotal ?? "0";

	// For guests, hide cart counter until client hydration to avoid flashing "0"
	const showGuestCounter = isLoggedIn || mounted;

	return (
		<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
			<Button
				aria-label={`Carrito con ${itemCount} producto${itemCount !== 1 ? "s" : ""}`}
				className="relative md:hidden"
				variant="outline"
				onClick={() => setDrawerOpen(true)}
			>
				<HugeiconsIcon icon={ShoppingCartIcon} size={16} />
				{showGuestCounter && hasItems && (
					<Badge
						className="-translate-y-1/2 -translate-x-1/2 absolute start-full top-0"
						radius="full"
						size="sm"
					>
						{displayCount}
					</Badge>
				)}
			</Button>

			<Button
				aria-label={`Carrito con ${itemCount} producto${itemCount !== 1 ? "s" : ""}`}
				className="hidden md:flex"
				variant="outline"
				onClick={() => setDrawerOpen(true)}
			>
				<HugeiconsIcon icon={ShoppingCartIcon} size={16} />
				{hasItems ? formatPrice(subtotal) : "Carrito"}
				{showGuestCounter && hasItems && (
					<Badge radius="full" size="sm">
						{displayCount}
					</Badge>
				)}
			</Button>

			<SheetContent side="right" className="flex w-full flex-col sm:max-w-md h-dvh max-h-dvh">
				<SheetHeader>
					<SheetTitle>Carrito{cart ? ` (${cart.itemsCount})` : ""}</SheetTitle>
				</SheetHeader>

				{cart ? (
					<CartDrawerContent
						cart={cart}
						isLoading={isCartLoading}
						onNavigate={() => setDrawerOpen(false)}
					/>
				) : (
					<div className="flex items-center justify-center py-12">
						<span className="text-muted-foreground text-sm">Cargando...</span>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
