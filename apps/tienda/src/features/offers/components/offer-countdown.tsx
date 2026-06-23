import { useOfferCountdown } from "../hooks/use-offer-countdown";

interface OfferCountdownProps {
	startsAt: string | Date;
	endsAt: string | Date;
	className?: string;
}

export function OfferCountdown({ startsAt, endsAt, className }: OfferCountdownProps) {
	const { label, status } = useOfferCountdown(startsAt, endsAt);

	const isMuted = status === "ended" || status === "upcoming";

	return (
		<time
			dateTime={typeof endsAt === "string" ? endsAt : endsAt.toISOString()}
			aria-live="polite"
			aria-atomic="true"
			className={`text-base font-medium tabular-nums md:text-lg ${isMuted ? "text-muted-foreground" : "text-foreground"} ${className ?? ""}`}
		>
			{label}
		</time>
	);
}
