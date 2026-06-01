import { Button } from "@renovabit/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@renovabit/ui/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@renovabit/ui/components/ui/field";
import { Textarea } from "@renovabit/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
	Autocomplete,
	AutocompleteContent,
	AutocompleteEmpty,
	AutocompleteInput,
	AutocompleteItem,
	AutocompleteList,
} from "@/shared/components/ui/autocomplete";
import { getFieldErrorId, normalizeFieldErrors } from "@/shared/lib/form/form-utils";
import { useAddToBlacklist } from "../hooks";
import { useProductSearch } from "../hooks/use-product-search";
import { BLACKLIST_REASON_MAX, type BlacklistFormValues, blacklistFormSchema } from "../model";

// ── Constants ────────────────────────────────────────────

const FORM_ID = "add-blacklist-form";

// ── Props ────────────────────────────────────────────────

interface AddBlacklistDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

// ── Component ────────────────────────────────────────────

export function AddBlacklistDialog({ open, onOpenChange }: AddBlacklistDialogProps) {
	const addToBlacklist = useAddToBlacklist();
	const queryClient = useQueryClient();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { search, setSearch, results, isLoading } = useProductSearch();
	const [selectedProduct, setSelectedProduct] = useState<{
		name: string;
		providerIds: Array<{ source: string; externalId: string }>;
	} | null>(null);

	// Ref para acceder al estado más reciente de autocompleteItems en el callback
	const autocompleteItemsRef = useRef<
		Array<{
			value: string;
			label: string;
			sku: string;
			providerIds: Array<{ source: string; externalId: string }>;
		}>
	>([]);

	const autocompleteItems = results.map((product) => ({
		value: product.name,
		label: product.name,
		sku: product.sku,
		providerIds: product.providerIds,
	}));

	// Mantener ref actualizado
	autocompleteItemsRef.current = autocompleteItems;

	const handleAutocompleteChange = useCallback(
		(value: string | null) => {
			const val = value ?? "";
			setSearch(val);

			if (!val) {
				setSelectedProduct(null);
				return;
			}

			// Usar ref para evitar stale closure
			const selected = autocompleteItemsRef.current.find((item) => item.value === val);
			if (selected) {
				setSelectedProduct({
					name: selected.label,
					providerIds: selected.providerIds,
				});
			} else {
				setSelectedProduct(null);
			}
		},
		[setSearch],
	);

	const form = useForm({
		defaultValues: { externalId: "", reason: "" } as BlacklistFormValues,
		validators: {
			onChange: blacklistFormSchema,
		},
		onSubmit: async ({ value }) => {
			// Validación manual: al menos una fuente de entrada
			const hasProduct = selectedProduct !== null && selectedProduct.providerIds.length > 0;
			const hasManualId = value.externalId.trim().length > 0;

			if (!hasProduct && !hasManualId) {
				toast.error("Selecciona un producto o escribe un ID externo manual");
				return;
			}

			setIsSubmitting(true);
			try {
				if (hasProduct) {
					for (const provider of selectedProduct!.providerIds) {
						await addToBlacklist.mutateAsync({
							externalId: provider.externalId,
							source: provider.source || undefined,
							productName: selectedProduct!.name,
							reason: value.reason || undefined,
						});
					}
				} else {
					await addToBlacklist.mutateAsync({
						externalId: value.externalId,
						reason: value.reason || undefined,
					});
				}
				form.reset();
				setSelectedProduct(null);
				setSearch("");
				onOpenChange(false);
			} catch {
				// El onError del hook ya muestra el toast
			} finally {
				setIsSubmitting(false);
				queryClient.invalidateQueries({ queryKey: ["products"] });
			}
		},
	});

	const hasSelection = selectedProduct !== null && selectedProduct.providerIds.length > 0;
	const canSubmit = hasSelection || search.trim().length > 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-md p-0 gap-0 max-h-[85dvh] flex flex-col overflow-hidden"
				showCloseButton={false}
			>
				<DialogHeader className="shrink-0 p-4">
					<DialogTitle>Añadir a lista negra</DialogTitle>
					<DialogDescription>
						{hasSelection
							? `Se bloqueará "${selectedProduct.name}" y no volverá a importarse.`
							: "Busca un producto para bloquear su ID de proveedor."}
					</DialogDescription>
				</DialogHeader>

				<form
					id={FORM_ID}
					className="flex flex-col gap-5 px-4 py-4"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						void form.handleSubmit();
					}}
					noValidate
				>
					<FieldGroup>
						{/* ── Product Autocomplete ── */}
						<Field>
							<FieldLabel>Producto</FieldLabel>
							<Autocomplete
								items={autocompleteItems}
								value={search}
								onValueChange={handleAutocompleteChange}
							>
								<AutocompleteInput
									showClear={search.length > 0}
									placeholder="Buscar por nombre o SKU…"
								/>
								<AutocompleteContent>
									<AutocompleteEmpty>
										{isLoading ? "Buscando…" : "Sin resultados."}
									</AutocompleteEmpty>
									<AutocompleteList>
										{(item) => (
											<AutocompleteItem
												key={item.value}
												value={item.value}
												className="flex flex-col items-start gap-0.5"
											>
												<span className="font-medium text-sm">{item.label}</span>
												<span className="text-muted-foreground text-xs">{item.sku}</span>
											</AutocompleteItem>
										)}
									</AutocompleteList>
								</AutocompleteContent>
							</Autocomplete>
							{hasSelection && (
								<p className="text-muted-foreground text-xs mt-1">
									{selectedProduct.providerIds.length}{" "}
									{selectedProduct.providerIds.length === 1 ? "ID bloqueado" : "IDs bloqueados"}:{" "}
									{selectedProduct.providerIds.map((p) => p.externalId).join(", ")}
								</p>
							)}
						</Field>

						{/* ── Manual externalId (fallback) ── */}
						{!hasSelection && (
							<form.Field name="externalId">
								{(field) => {
									const wasSubmitted = field.form.state.submissionAttempts > 0;
									const isInvalid =
										(field.state.meta.isTouched || wasSubmitted) &&
										field.state.meta.errors.length > 0;
									const errorMessageId = getFieldErrorId(FORM_ID, field.name);

									return (
										<Field>
											<FieldLabel htmlFor={`${FORM_ID}-externalId`}>ID externo (manual)</FieldLabel>
											<input
												id={`${FORM_ID}-externalId`}
												name={field.name}
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
												placeholder="O escribe el ID del proveedor"
												className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
												autoComplete="off"
											/>
											{isInvalid && (
												<FieldError
													id={errorMessageId}
													errors={normalizeFieldErrors(field.state.meta.errors)}
												/>
											)}
										</Field>
									);
								}}
							</form.Field>
						)}

						{/* ── Reason ── */}
						<form.Field name="reason">
							{(field) => {
								const wasSubmitted = field.form.state.submissionAttempts > 0;
								const isInvalid =
									(field.state.meta.isTouched || wasSubmitted) &&
									field.state.meta.errors.length > 0;
								const errorMessageId = getFieldErrorId(FORM_ID, field.name);

								return (
									<Field>
										<FieldLabel htmlFor={`${FORM_ID}-reason`}>Motivo (opcional)</FieldLabel>
										<Textarea
											id={`${FORM_ID}-reason`}
											name={field.name}
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											maxLength={BLACKLIST_REASON_MAX}
											placeholder="¿Por qué se bloquea este ID?"
											rows={3}
											aria-invalid={isInvalid || undefined}
											aria-describedby={isInvalid ? errorMessageId : undefined}
										/>
										{isInvalid && (
											<FieldError
												id={errorMessageId}
												errors={normalizeFieldErrors(field.state.meta.errors)}
											/>
										)}
									</Field>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>

				<DialogFooter
					className="mx-0 mb-0 shrink-0 px-4 pb-4"
					showCloseButton
					closeLabel="Cancelar"
				>
					<Button type="submit" form={FORM_ID} disabled={isSubmitting || !canSubmit}>
						{isSubmitting ? "Añadiendo..." : "Añadir a lista negra"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
