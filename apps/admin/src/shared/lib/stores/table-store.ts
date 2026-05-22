import type { SortingState, VisibilityState } from "@tanstack/react-table";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TablePersistState {
	columnVisibility: VisibilityState;
	sorting: SortingState;
}

export interface TableStoreActions {
	setColumnVisibility: (
		updater: VisibilityState | ((prev: VisibilityState) => VisibilityState),
	) => void;
	setSorting: (updater: SortingState | ((prev: SortingState) => SortingState)) => void;
}

export type TableStore = TablePersistState & TableStoreActions;

// ── Factory ──────────────────────────────────────────

export function createTableStore(storageKey: string, initialState?: Partial<TablePersistState>) {
	return create<TableStore>()(
		persist(
			(set) => ({
				columnVisibility: {},
				sorting: [],
				...initialState,
				setColumnVisibility: (updater) =>
					set((state) => ({
						...state,
						columnVisibility:
							typeof updater === "function" ? updater(state.columnVisibility) : updater,
					})),
				setSorting: (updater) =>
					set((state) => ({
						...state,
						sorting: typeof updater === "function" ? updater(state.sorting) : updater,
					})),
			}),
			{ name: `table-${storageKey}` },
		),
	);
}
