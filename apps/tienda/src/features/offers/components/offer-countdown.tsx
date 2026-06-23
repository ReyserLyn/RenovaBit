interface OfferCountdownProps {
	label: string;
	status: "upcoming" | "active" | "ending" | "ended";
	endsAt: string | Date;
	className?: string;
}

export function OfferCountdown({ label, status, endsAt, className }: OfferCountdownProps) {
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
