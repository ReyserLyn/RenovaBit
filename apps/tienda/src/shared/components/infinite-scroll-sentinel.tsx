import { Spinner } from "@renovabit/ui/components/ui/spinner";
import { useEffect, useState } from "react";
import { useInfiniteScroll } from "@/shared/hooks/use-infinite-scroll";

interface InfiniteScrollSentinelProps {
	hasNextPage: boolean;
	/** Guard principal — true durante CUALQUIER fetch */
	isFetching: boolean;
	/** Solo para UI (spinner) — true durante fetchNextPage */
	isFetchingNextPage: boolean;
	fetchNextPage: () => void;
	rootMargin?: number;
}

/**
 * Sentinel + spinner diferido para infinite scroll.
 * El spinner solo aparece si el fetch tarda >300ms — si los datos llegan antes, no se muestra.
 */
export function InfiniteScrollSentinel({
	hasNextPage,
	isFetching,
	isFetchingNextPage,
	fetchNextPage,
	rootMargin,
}: InfiniteScrollSentinelProps) {
	const sentinelRef = useInfiniteScroll({
		hasNextPage,
		isFetching,
		fetchNextPage,
		rootMargin,
	});
	const [showSpinner, setShowSpinner] = useState(false);

	// Defer de 300ms: solo mostrar spinner si el fetch tarda
	useEffect(() => {
		if (!isFetchingNextPage) {
			setShowSpinner(false);
			return;
		}

		const timer = setTimeout(() => setShowSpinner(true), 300);
		return () => clearTimeout(timer);
	}, [isFetchingNextPage]);

	return (
		<div ref={sentinelRef} className="flex justify-center py-4">
			{showSpinner && <Spinner className="size-6 text-muted-foreground" />}
		</div>
	);
}
