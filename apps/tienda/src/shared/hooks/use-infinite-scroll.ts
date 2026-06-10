import { useEffect, useRef } from "react";

interface UseInfiniteScrollOptions {
	hasNextPage: boolean;
	/** Guard principal — true durante cualquier fetch (refetch, nextPage, etc). */
	isFetching: boolean;
	fetchNextPage: () => void;
	/** Margen inferior en px para prefetch anticipado (default: 600). */
	rootMargin?: number;
}

/**
 * Infinite scroll con IntersectionObserver + rootMargin para prefetch anticipado.
 * Si el viewport no se llena con la primera página, dispara fetchNextPage() automáticamente.
 */
export function useInfiniteScroll({
	hasNextPage,
	isFetching,
	fetchNextPage,
	rootMargin = 600,
}: UseInfiniteScrollOptions) {
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isFetching || !hasNextPage) return;

		const el = sentinelRef.current;
		if (!el) return;

		// Auto-fill: ¿el viewport necesita más contenido?
		if (el.getBoundingClientRect().top < window.innerHeight + rootMargin) {
			fetchNextPage();
			return;
		}

		// Viewport lleno: observer con prefetch anticipado
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) fetchNextPage();
			},
			{ rootMargin: `0px 0px ${rootMargin}px 0px` },
		);

		observer.observe(el);
		return () => observer.disconnect();
	}, [hasNextPage, isFetching, fetchNextPage, rootMargin]);

	return sentinelRef;
}
