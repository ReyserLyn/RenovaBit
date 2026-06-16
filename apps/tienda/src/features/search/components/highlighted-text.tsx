import { cn } from "@renovabit/ui/lib/utils";
import type { ReactNode } from "react";

interface HighlightedTextProps {
	text: string | null;
	className?: string;
}

const HIGHLIGHT_START = String.fromCharCode(1);
const HIGHLIGHT_END = String.fromCharCode(2);
const HIGHLIGHT_RE = new RegExp(`([${HIGHLIGHT_START}${HIGHLIGHT_END}])`, "g");

/**
 * Safe parser for ts_headline output from Postgres FTS.
 * Uses rare Unicode markers (SOH / STX) to avoid collision
 * with literal markup characters in product names.
 * NEVER uses dangerouslySetInnerHTML — 100% safe React rendering.
 */
export function HighlightedText({ text, className }: HighlightedTextProps) {
	if (!text) {
		return (
			<span className={cn("text-muted-foreground", className)} aria-hidden="true">
				&mdash;
			</span>
		);
	}

	const parts = text.split(HIGHLIGHT_RE);
	const elements: ReactNode[] = [];
	let bold = false;
	let key = 0;

	for (const part of parts) {
		if (part === HIGHLIGHT_START) {
			bold = true;
			continue;
		}
		if (part === HIGHLIGHT_END) {
			bold = false;
			continue;
		}

		if (bold) {
			elements.push(
				<b key={key++} className="font-bold text-foreground">
					{part}
				</b>,
			);
		} else {
			elements.push(<span key={key++}>{part}</span>);
		}
	}

	return <span className={className}>{elements}</span>;
}
