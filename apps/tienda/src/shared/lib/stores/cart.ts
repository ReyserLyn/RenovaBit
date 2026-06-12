import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CartGuestState {
	guestToken: string | null;
	setGuestToken: (token: string) => void;
	clearGuestToken: () => void;
}

export const useCartGuestStore = create<CartGuestState>()(
	persist(
		(set) => ({
			guestToken: null,
			setGuestToken: (token: string) => set({ guestToken: token }),
			clearGuestToken: () => set({ guestToken: null }),
		}),
		{ name: "renovabit-cart-guest" },
	),
);
