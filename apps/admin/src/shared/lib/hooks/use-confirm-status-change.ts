import { useCallback, useState } from "react";

/**
 * Hook that manages a status-change confirmation dialog state.
 *
 * @typeParam T - Extra data attached to the confirmation (e.g. order info).
 */
export function useConfirmStatusChange<T = unknown>() {
	const [confirmState, setConfirmState] = useState<{
		data: T;
		newStatus: string;
	} | null>(null);

	const requestChange = useCallback((data: T, newStatus: string) => {
		setConfirmState({ data, newStatus });
	}, []);

	const close = useCallback(() => {
		setConfirmState(null);
	}, []);

	return {
		confirmState,
		requestChange,
		close,
	};
}
