import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Kbd } from "@renovabit/ui/components/ui/kbd";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import { cn } from "@renovabit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import hotkeys from "hotkeys-js";
import { useEffect, useId, useRef, useState } from "react";
import { HighlightedText } from "@/features/search/components/highlighted-text";
import { searchQueries } from "@/features/search/hooks/queries";
import {
	Autocomplete,
	AutocompleteContent,
	AutocompleteEmpty,
	AutocompleteInput,
	AutocompleteItem,
	AutocompleteList,
	AutocompleteRow,
} from "@/shared/components/ui/autocomplete";

const SKELETON_ITEM_COUNT = 5;

function AutocompleteSkeleton() {
	return (
		<>
			{Array.from({ length: SKELETON_ITEM_COUNT }, (_, i) => (
				<div
					key={i}
					className="grid w-full min-h-12 grid-cols-[40px_1fr_auto] items-center gap-3 px-1.5 py-1"
					aria-hidden="true"
				>
					<Skeleton className="size-10 rounded" />
					<div className="flex min-w-0 flex-col gap-1.5">
						<Skeleton className="h-3.5 w-3/4" />
						<Skeleton className="h-2.5 w-1/2" />
					</div>
					<Skeleton className="h-3.5 w-14" />
				</div>
			))}
		</>
	);
}

type SearchAutocompleteProps = {
	className?: string;
	placeholder?: string;
	initialQuery?: string;
	disableHotkey?: boolean;
};

export default function SearchAutocomplete({
	className,
	placeholder = "Buscar productos...",
	initialQuery,
	disableHotkey = false,
}: SearchAutocompleteProps) {
	const id = useId();
	const navigate = useNavigate();
	const containerRef = useRef<HTMLDivElement>(null);
	const [modKey, setModKey] = useState("Ctrl");

	// `inputValue` is the immediate value the user sees (for instant UI feedback)
	// `currentQuery` is the debounced value that actually triggers the network request
	// `isTyping` is true between keystroke and debounce fire, so we can show "Buscando..." right away
	const [inputValue, setInputValue] = useState(initialQuery ?? "");
	const [currentQuery, setCurrentQuery] = useState(initialQuery ?? "");
	const [isTyping, setIsTyping] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const {
		data: results = [],
		isFetching,
		error,
	} = useQuery({
		...searchQueries.autocomplete(currentQuery),
		enabled: currentQuery.length >= 2,
	});

	const handleInputChange = (value: string) => {
		setInputValue(value);
		setIsTyping(true);
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		debounceRef.current = setTimeout(() => {
			setIsTyping(false);
			setCurrentQuery(value);
		}, 300);
	};

	// Sync input with URL query changes (e.g., navigating between /buscar?q=foo and /buscar?q=bar)
	useEffect(() => {
		if (initialQuery !== undefined) {
			setInputValue(initialQuery);
			setCurrentQuery(initialQuery);
		}
	}, [initialQuery]);

	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	// Detect OS for keyboard shortcut display
	useEffect(() => {
		if (navigator.platform.includes("Mac")) {
			setModKey("\u2318");
		}
	}, []);

	// Ctrl+K / Cmd+K to focus search
	useEffect(() => {
		if (disableHotkey) return;

		hotkeys("ctrl+k, command+k", (event) => {
			event.preventDefault();
			const input = containerRef.current?.querySelector("input");
			input?.focus();
		});

		return () => {
			hotkeys.unbind("ctrl+k, command+k");
		};
	}, [disableHotkey]);

	// Navigate to product when an item is selected via click/Enter
	// NOTE: Base UI's Autocomplete.Root fires onValueChange for EVERY input change,
	// not just for item selection. We validate the value is a known product slug to
	// prevent navigating on every keystroke. There is a theoretical race condition if
	// `results` swaps between the click and the handler, but it's rare and a 1-frame
	// miss is acceptable vs constant misbehavior.
	const handleValueChange = (value: string | null) => {
		if (!value) return;
		const matched = results.find((p) => p.slug === value);
		if (!matched) return;
		navigate({ to: "/producto/$slug", params: { slug: matched.slug } });
		// Reset state immediately — don't race with results lookup
		setInputValue("");
		setCurrentQuery("");
		setIsTyping(false);
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		// Remove focus from the search input
		containerRef.current?.querySelector("input")?.blur();
	};

	const handleSubmit = () => {
		// Use inputValue (immediate keystrokes) not currentQuery (debounced)
		// so Enter-submits use the latest typed text even before debounce fires
		const trimmed = inputValue.trim();
		if (trimmed.length >= 2) {
			navigate({ to: "/buscar", search: { q: trimmed } });
			containerRef.current?.querySelector("input")?.blur();
		}
	};

	// Derived UI state — show feedback immediately (don't wait for debounce)
	const trimmedInput = inputValue.trim();
	const hasInput = trimmedInput.length >= 2;
	const isLoading = hasInput && (isTyping || isFetching);
	const hasError = hasInput && !isLoading && Boolean(error);
	const hasNoResults = hasInput && !isLoading && !hasError && results.length === 0;

	return (
		<div className={cn("w-full max-w-sm", className)}>
			<Autocomplete onValueChange={handleValueChange}>
				<div ref={containerRef} className="relative w-full">
					<div
						className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-2.5 text-foreground/70"
						aria-hidden="true"
					>
						<HugeiconsIcon icon={Search01Icon} size={18} />
					</div>

					<AutocompleteInput
						id={id}
						placeholder={placeholder}
						className="h-10 bg-muted/50 border-transparent hover:bg-muted focus-within:bg-background transition-all duration-200 pl-9 pr-16"
						value={inputValue}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
							handleInputChange(e.target.value);
						}}
						onKeyDown={(e: React.KeyboardEvent) => {
							if (e.key === "Enter" && !e.defaultPrevented) {
								e.preventDefault();
								handleSubmit();
							}
						}}
					/>

					<div
						className={cn(
							"pointer-events-none absolute inset-y-0 right-0 flex items-center gap-1 pr-2.5 transition-opacity",
							inputValue ? "opacity-30" : "opacity-60",
						)}
					>
						<Kbd>{modKey}</Kbd>
						<Kbd>K</Kbd>
					</div>
				</div>

				<AutocompleteContent align="start" sideOffset={8} className="w-(--anchor-width)">
					{isLoading && (
						<div
							role="status"
							aria-label="Buscando productos"
							className="flex flex-col gap-0.5 py-1"
						>
							<AutocompleteSkeleton />
						</div>
					)}

					<AutocompleteList
						aria-label={
							results.length > 0
								? `${results.length} ${results.length === 1 ? "resultado" : "resultados"}`
								: undefined
						}
					>
						{!isLoading &&
							results.map((product) => (
								<AutocompleteItem key={product.id} value={product.slug}>
									<AutocompleteRow className="grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 min-h-12">
										{product.primaryImage ? (
											<img
												src={product.primaryImage.url}
												alt={product.primaryImage.alt ?? ""}
												className="size-10 shrink-0 rounded object-cover"
											/>
										) : (
											<div className="size-10 shrink-0 rounded bg-muted" />
										)}
										<div className="min-w-0">
											<div className="truncate text-sm font-medium leading-tight">
												<HighlightedText text={product.headline ?? product.name} />
											</div>
											<div className="text-muted-foreground mt-0.5 truncate text-xs leading-tight">
												{product.brand?.name}
												{product.brand && product.category ? " \u00b7 " : ""}
												{product.category?.name}
											</div>
										</div>
										<div className="shrink-0 text-right">
											<div className="text-sm font-semibold whitespace-nowrap tabular-nums">
												S/ {product.price}
											</div>
											{!product.isInStock && (
												<div className="text-destructive mt-1 block text-[0.7rem] font-semibold uppercase tracking-wider leading-tight">
													Agotado
												</div>
											)}
										</div>
									</AutocompleteRow>
								</AutocompleteItem>
							))}

						{hasError && (
							<AutocompleteEmpty role="status">
								Error al buscar. Intenta de nuevo.
							</AutocompleteEmpty>
						)}

						{hasNoResults && (
							<AutocompleteEmpty role="status">
								Sin resultados para &ldquo;{trimmedInput}&rdquo;
							</AutocompleteEmpty>
						)}
					</AutocompleteList>
				</AutocompleteContent>
			</Autocomplete>
		</div>
	);
}
