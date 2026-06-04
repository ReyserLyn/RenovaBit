import { useEffect, useState } from "react";

/**
 * Debounce a value by a given delay in ms.
 * El valor retornado solo se actualiza después de que el input
 * haya permanecido estable durante `delay` ms.
 *
 * ⚠️  Para inputs de búsqueda en tiempo real, prefiere `useDeferredValue`
 *     de React en vez de debounce — permite que el input se actualice
 *     al instante y difiere solo el render costoso.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedValue(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);

	return debouncedValue;
}
