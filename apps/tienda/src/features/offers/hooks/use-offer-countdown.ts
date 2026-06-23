import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

type CountdownStatus = "upcoming" | "active" | "ending" | "ended";

interface CountdownResult {
	label: string;
	status: CountdownStatus;
}

function parseDate(d: string | Date): number {
	return typeof d === "string" ? new Date(d).getTime() : d.getTime();
}

function formatDuration(ms: number): { days: number; hours: number; minutes: number } {
	const totalSeconds = Math.floor(ms / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	return { days, hours, minutes };
}

function computeLabel(now: number, startsAt: number, endsAt: number): CountdownResult {
	if (now >= endsAt) {
		return { label: "Finalizada", status: "ended" };
	}

	if (now < startsAt) {
		const diff = startsAt - now;
		const { days, hours, minutes } = formatDuration(diff);
		const parts: string[] = [];
		if (days > 0) parts.push(`${days}d`);
		if (hours > 0) parts.push(`${hours}h`);
		parts.push(`${minutes}m`);
		return { label: `Comienza en ${parts.join(" ")}`, status: "upcoming" };
	}

	// Active (now >= startsAt && now < endsAt)
	const remaining = endsAt - now;
	if (remaining < 60_000) {
		return { label: "Menos de 1 minuto", status: "ending" };
	}

	const { days, hours, minutes } = formatDuration(remaining);
	const parts: string[] = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	parts.push(`${minutes}m`);

	return { label: `Termina en ${parts.join(" ")}`, status: "active" };
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribePrefersReducedMotion(callback: () => void): () => void {
	if (typeof window === "undefined") return () => undefined;
	const mql = window.matchMedia(REDUCED_MOTION_QUERY);
	mql.addEventListener("change", callback);
	return () => mql.removeEventListener("change", callback);
}

function getPrefersReducedMotionSnapshot(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

const getServerSnapshot = () => false;

export function useOfferCountdown(startsAt: string | Date, endsAt: string | Date): CountdownResult {
	const isReducedMotion = useSyncExternalStore(
		subscribePrefersReducedMotion,
		getPrefersReducedMotionSnapshot,
		getServerSnapshot,
	);

	const interval = isReducedMotion ? 60_000 : 1_000;

	// Initialize `now` to null on both server and first client render so the
	// initial markup matches → no hydration mismatch. The real value is set
	// inside useEffect (client-only).
	const [now, setNow] = useState<number | null>(null);

	useEffect(() => {
		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), interval);
		return () => clearInterval(timer);
	}, [interval]);

	return useMemo<CountdownResult>(() => {
		const startsAtMs = parseDate(startsAt);
		const endsAtMs = parseDate(endsAt);

		// Before mount (SSR + first client render): compute against endsAt so
		// the label is stable and never shows "ended" prematurely. The visible
		// text will be replaced on the first effect tick.
		const effectiveNow = now ?? endsAtMs;
		return computeLabel(effectiveNow, startsAtMs, endsAtMs);
	}, [now, startsAt, endsAt]);
}
