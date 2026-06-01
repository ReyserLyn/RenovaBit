import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SyncCompletedEvent, SyncProgress } from "@/features/notifications/model";

type SyncStore = {
	progress: SyncProgress | null;
	lastCompleted: SyncCompletedEvent | null;
	setProgress: (p: SyncProgress | null) => void;
	setCompleted: (e: SyncCompletedEvent) => void;
	clearCompleted: () => void;
};

export const useSyncStore = create<SyncStore>()(
	persist(
		(set) => ({
			progress: null,
			lastCompleted: null,
			setProgress: (progress) => set({ progress }),
			setCompleted: (lastCompleted) => set({ progress: null, lastCompleted }),
			clearCompleted: () => set({ lastCompleted: null }),
		}),
		{
			name: "renovabit-sync",
			partialize: (state) => ({ progress: state.progress }),
		},
	),
);
