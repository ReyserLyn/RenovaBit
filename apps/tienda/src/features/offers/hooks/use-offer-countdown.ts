import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useCartSsr } from "@/shared/lib/stores/cart-ssr-context";

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

function formatParts(days: number, hours: number, minutes: number) {
	const parts: string[] = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	parts.push(`${minutes}m`);
	return parts.join(" ");
}

function computeLabel(now: number, startsAt: number, endsAt: number): CountdownResult {
	if (now >= endsAt) {
		return { label: "Finalizada", status: "ended" };
	}

	if (now < startsAt) {
		const { days, hours, minutes } = formatDuration(startsAt - now);
		return { label: `Comienza en ${formatParts(days, hours, minutes)}`, status: "upcoming" };
	}

	// Active (now >= startsAt && now < endsAt)
	const remaining = endsAt - now;
	if (remaining < 60_000) {
		return { label: "Menos de 1 minuto", status: "ending" };
	}

	const { days, hours, minutes } = formatDuration(remaining);
	return { label: `Termina en ${formatParts(days, hours, minutes)}`, status: "active" };
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
	const { serverNow } = useCartSsr();
	const isReducedMotion = useSyncExternalStore(
		subscribePrefersReducedMotion,
		getPrefersReducedMotionSnapshot,
		getServerSnapshot,
	);

	// Seed `now` with the request-time timestamp so the server render and
	// the first client paint show the same label. After mount the client
	// switches to the live clock via the effect.
	const [now, setNow] = useState<number | null>(serverNow);

	useEffect(() => {
		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), isReducedMotion ? 60_000 : 1_000);
		return () => clearInterval(timer);
	}, [isReducedMotion]);

	return useMemo<CountdownResult>(
		() => computeLabel(now ?? serverNow ?? Date.now(), parseDate(startsAt), parseDate(endsAt)),
		[now, serverNow, startsAt, endsAt],
	);
}
