import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoritesState {
	favorites: string[];
	add: (slug: string) => void;
	remove: (slug: string) => void;
	toggle: (slug: string) => void;
	isFavorite: (slug: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
	persist(
		(set, get) => ({
			favorites: [],

			add: (slug: string) => {
				set((state) => {
					if (state.favorites.includes(slug)) return state;
					return { favorites: [...state.favorites, slug] };
				});
			},

			remove: (slug: string) => {
				set((state) => ({
					favorites: state.favorites.filter((s) => s !== slug),
				}));
			},

			toggle: (slug: string) => {
				const { favorites } = get();
				if (favorites.includes(slug)) {
					get().remove(slug);
				} else {
					get().add(slug);
				}
			},

			isFavorite: (slug: string) => {
				return get().favorites.includes(slug);
			},
		}),
		{
			name: "renovabit-favorites",
		},
	),
);
