import { createContext, useContext } from "react";
import type { Session } from "@/shared/lib/auth/auth-client";

interface CartSsrData {
	session: Session | null;
	cartTotal: { itemsCount: number; subtotal: string } | null;
}

const CartSsrContext = createContext<CartSsrData | null>(null);

export function CartSsrProvider({
	value,
	children,
}: {
	value: CartSsrData;
	children: React.ReactNode;
}) {
	return <CartSsrContext.Provider value={value}>{children}</CartSsrContext.Provider>;
}

export function useCartSsr(): CartSsrData {
	const ctx = useContext(CartSsrContext);
	if (!ctx) {
		return { session: null, cartTotal: null };
	}
	return ctx;
}
