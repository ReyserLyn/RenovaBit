import type { ReactNode } from "react";
import { BUSINESS } from "@/shared/lib/business";

interface LegalPageProps {
	title: string;
	subtitle?: string;
	updatedAt: string;
	children: ReactNode;
}

/**
 * Shared shell for the legal pages: consistent typography, width and heading
 * semantics. Content itself lives in each route so legal copy is reviewable in
 * one place.
 */
export function LegalPage({ title, subtitle, updatedAt, children }: LegalPageProps) {
	return (
		<article className="mx-auto w-full max-w-3xl py-8 sm:py-12">
			<header className="mb-8 space-y-2">
				<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
				{subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
				<p className="text-muted-foreground text-xs">
					Última actualización: <time dateTime={BUSINESS.legalUpdatedIso}>{updatedAt}</time>
				</p>
			</header>
			<div className="space-y-8 text-sm leading-relaxed text-foreground/85">{children}</div>
		</article>
	);
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-3">
			<h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
			{children}
		</section>
	);
}

export function LegalList({ items }: { items: ReadonlyArray<ReactNode> }) {
	return (
		<ul className="list-disc space-y-1.5 pl-5">
			{items.map((item, index) => (
				// Legal copy is static and ordered; index keys are stable here.
				<li key={index}>{item}</li>
			))}
		</ul>
	);
}
