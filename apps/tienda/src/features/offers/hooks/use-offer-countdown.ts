import { useEffect, useMemo, useState } from "react";

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
		const { hours, minutes } = formatDuration(diff);
		if (hours > 0) {
			return { label: `Comienza en ${hours}h ${minutes}m`, status: "upcoming" };
		}
		return { label: `Comienza en ${minutes}m`, status: "upcoming" };
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

export function useOfferCountdown(startsAt: string | Date, endsAt: string | Date): CountdownResult {
	const isReducedMotion =
		typeof window !== "undefined"
			? window.matchMedia("(prefers-reduced-motion: reduce)").matches
			: false;

	const interval = isReducedMotion ? 60_000 : 1_000;

	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), interval);
		return () => clearInterval(timer);
	}, [interval]);

	return useMemo(() => {
		const startsAtMs = parseDate(startsAt);
		const endsAtMs = parseDate(endsAt);
		return computeLabel(now, startsAtMs, endsAtMs);
	}, [now, startsAt, endsAt]);
}
