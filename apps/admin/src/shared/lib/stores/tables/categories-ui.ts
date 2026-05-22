import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CategoriesUIState {
	treeExpanded: boolean;
	setTreeExpanded: (v: boolean) => void;
}

export const useCategoriesUIStore = create<CategoriesUIState>()(
	persist(
		(set) => ({
			treeExpanded: true,
			setTreeExpanded: (v: boolean) => set({ treeExpanded: v }),
		}),
		{ name: "categories-ui" },
	),
);
