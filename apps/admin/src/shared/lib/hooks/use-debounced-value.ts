import { useEffect, useState } from "react";

/**
 * Debounce a value by a given delay in ms.
 * El valor retornado solo se actualiza después de que el input
 * haya permanecido estable durante `delay` ms.
 *
 * Usa `rerender-use-deferred-value` pattern: mantiene el input
 * responsive mientras evita filtros costosos en cada keystroke.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedValue(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);

	return debouncedValue;
}
