import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_KEY = "renovabit-guest-token";
const LEGACY_KEY = "renovabit-cart-guest";

interface GuestTokenState {
	guestToken: string | null;
	setGuestToken: (token: string) => void;
	clearGuestToken: () => void;
}

/**
 * Attempts to read and return a guest token from the legacy localStorage key.
 * Returns null if no legacy token exists or on parse error.
 */
function readLegacyToken(): string | null {
	try {
		const raw = localStorage.getItem(LEGACY_KEY);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as { state?: { guestToken?: string | null } };
		const token = parsed?.state?.guestToken ?? null;

		if (token && typeof token === "string") {
			return token;
		}
	} catch {
		// Ignore parse errors
	}
	return null;
}

/**
 * Guest token store used by cart.
 *
 * Persists to `renovabit-guest-token`. On first hydration, checks the legacy
 * `renovabit-cart-guest` key and migrates any existing token to the new key,
 * then removes the legacy key.
 */
export const useGuestTokenStore = create<GuestTokenState>()(
	persist(
		(set) => ({
			guestToken: null,
			setGuestToken: (token: string) => set({ guestToken: token }),
			clearGuestToken: () => set({ guestToken: null }),
		}),
		{
			name: STORAGE_KEY,
			onRehydrateStorage: () => {
				// Run migration after store fully hydrates
				return (state) => {
					if (state?.guestToken) return; // Already migrated or new key has data

					const legacyToken = readLegacyToken();
					if (legacyToken) {
						useGuestTokenStore.getState().setGuestToken(legacyToken);
						try {
							localStorage.removeItem(LEGACY_KEY);
						} catch {
							// Ignore
						}
					}
				};
			},
		},
	),
);
