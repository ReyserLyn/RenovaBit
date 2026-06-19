import { Package01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@renovabit/ui/components/ui/field";
import { Input } from "@renovabit/ui/components/ui/input";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { Switch } from "@renovabit/ui/components/ui/switch";
import { Textarea } from "@renovabit/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import { DateTimePicker } from "@/shared/components/date-picker";
import { ProductPicker } from "@/shared/components/product-picker/product-picker";
import { getFieldErrorId, normalizeFieldErrors } from "@/shared/lib/form/form-utils";
import { generateSlug } from "@/shared/lib/slug";
import {
	OFFER_DESCRIPTION_MAX,
	OFFER_NAME_MAX,
	OFFER_SLUG_MAX,
	type OfferFormValues,
	offerFormSchema,
} from "../validators";

// ── Constants ────────────────────────────────────────────

export const OFFER_FORM_ID = "offer-form";

// ── Props ────────────────────────────────────────────────

interface OfferFormCreateProps {
	mode?: "create";
	defaultValues: OfferFormValues;
	onMutation: (data: OfferFormValues) => Promise<unknown>;
	onSuccess: () => void;
	onSubmittingChange?: (isSubmitting: boolean) => void;
}

interface OfferFormEditProps {
	mode: "edit";
	offer: {
		id: string;
		name: string;
		slug: string;
		description: string | null;
		discountValue: string;
		// API serializes timestamps as ISO strings; accept both for flexibility.
		startsAt: string | Date | null;
		endsAt: string | Date | null;
		isActive: boolean;
		isFeatured: boolean;
		productIds?: string[];
	};
	onMutation: (data: OfferFormValues) => Promise<unknown>;
	onSuccess: () => void;
	onSubmittingChange?: (isSubmitting: boolean) => void;
}

export type OfferFormProps = OfferFormCreateProps | OfferFormEditProps;

// ── Component ────────────────────────────────────────────

export function OfferForm(props: OfferFormProps) {
	const { onMutation, onSuccess } = props;
	const isEdit = props.mode === "edit";

	const defaultValues: OfferFormValues = isEdit
		? {
				name: props.offer.name,
				slug: props.offer.slug,
				description: props.offer.description ?? "",
				discountValue: Number.parseFloat(props.offer.discountValue),
				startsAt: props.offer.startsAt ? new Date(props.offer.startsAt) : undefined,
				endsAt: props.offer.endsAt ? new Date(props.offer.endsAt) : undefined,
				isActive: props.offer.isActive,
				isFeatured: props.offer.isFeatured,
				productIds: props.offer.productIds ?? [],
			}
		: props.defaultValues;

	const slugManuallyEditedRef = useRef(isEdit);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
	const prevSubmittingRef = useRef(false);
	const { onSubmittingChange } = props;

	useEffect(() => {
		if (onSubmittingChange && prevSubmittingRef.current !== isSubmitting) {
			prevSubmittingRef.current = isSubmitting;
			onSubmittingChange(isSubmitting);
		}
	}, [isSubmitting, onSubmittingChange]);

	const form = useForm({
		defaultValues,
		validators: {
			onChange: offerFormSchema,
			onSubmit: offerFormSchema,
		},
		onSubmit: async ({ value }) => {
			setIsSubmitting(true);
			try {
				await onMutation(value);
				onSuccess();
			} finally {
				setIsSubmitting(false);
				onSubmittingChange?.(false);
			}
		},
	});

	return (
		<form
			id={OFFER_FORM_ID}
			className="flex flex-col gap-5"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			noValidate
		>
			<FieldGroup>
				{/* ── Name ── */}
				<form.Field name="name">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(OFFER_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>
									<span>
										Nombre{" "}
										<span aria-hidden="true" className="text-destructive">
											*
										</span>
										<span className="sr-only">obligatorio</span>
									</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => {
										const v = e.target.value;
										field.handleChange(v);
										if (!slugManuallyEditedRef.current) {
											form.setFieldValue("slug", generateSlug(v));
										}
									}}
									onBlur={field.handleBlur}
									placeholder="Ej: Cyber Monday 2024"
									disabled={isSubmitting}
									aria-invalid={isInvalid}
									aria-describedby={isInvalid ? errorMessageId : undefined}
									maxLength={OFFER_NAME_MAX}
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

				{/* ── Slug ── */}
				<form.Field name="slug">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(OFFER_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Slug</FieldLabel>
								<FieldDescription>
									Opcional. Se genera desde el nombre. Puedes editarlo manualmente.
								</FieldDescription>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => {
										slugManuallyEditedRef.current = true;
										field.handleChange(e.target.value);
									}}
									onBlur={field.handleBlur}
									placeholder="cyber-monday-2024"
									disabled={isSubmitting}
									className="font-mono text-sm"
									aria-invalid={isInvalid}
									aria-describedby={isInvalid ? errorMessageId : undefined}
									maxLength={OFFER_SLUG_MAX}
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

				{/* ── Description ── */}
				<form.Field name="description">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(OFFER_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Descripción</FieldLabel>
								<Textarea
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Descripción de la oferta..."
									rows={2}
									disabled={isSubmitting}
									aria-invalid={isInvalid}
									aria-describedby={isInvalid ? errorMessageId : undefined}
									maxLength={OFFER_DESCRIPTION_MAX}
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

			<Separator />

			{/* ── Discount ── */}
			<FieldGroup>
				<header className="flex flex-col">
					<h3 className="font-medium text-foreground text-sm">Descuento</h3>
				</header>

				<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
					<form.Field name="discountValue">
						{(field) => {
							const wasSubmitted = field.form.state.submissionAttempts > 0;
							const isInvalid =
								(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
							const errorMessageId = getFieldErrorId(OFFER_FORM_ID, field.name);

							return (
								<Field className="sm:max-w-xs" data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										Porcentaje de descuento{" "}
										<span aria-hidden="true" className="text-destructive">
											*
										</span>
									</FieldLabel>
									<FieldDescription>Valor entre 0 y 100.</FieldDescription>
									<Input
										id={field.name}
										name={field.name}
										type="number"
										min={0}
										step="0.01"
										value={field.state.value}
										onChange={(e) => field.handleChange(Number.parseFloat(e.target.value) || 0)}
										onBlur={field.handleBlur}
										placeholder="25"
										disabled={isSubmitting}
										className="font-mono tabular-nums"
										aria-invalid={isInvalid}
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
				</div>
			</FieldGroup>

			<Separator />

			{/* ── Products ── */}
			<FieldGroup>
				<header className="flex flex-col">
					<h3 className="font-medium text-foreground text-sm">Productos</h3>
					<FieldDescription>
						Selecciona los productos a los que se aplica esta oferta.
					</FieldDescription>
				</header>

				<form.Field name="productIds">
					{(pField) => {
						const productIds = pField.state.value ?? [];

						return (
							<>
								<Field>
									<FieldLabel>Productos seleccionados</FieldLabel>
									<FieldDescription>
										{productIds.length > 0
											? `${productIds.length} producto(s) seleccionado(s)`
											: "Ningún producto seleccionado"}
									</FieldDescription>
									<div className="flex flex-wrap items-center gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => setIsProductPickerOpen(true)}
											disabled={isSubmitting}
										>
											<HugeiconsIcon icon={Package01Icon} className="mr-2 size-4" />
											{productIds.length > 0 ? "Cambiar productos" : "Seleccionar productos"}
										</Button>
										{productIds.length > 0 && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => pField.handleChange([])}
												disabled={isSubmitting}
												className="text-destructive"
											>
												Limpiar
											</Button>
										)}
									</div>
								</Field>
								<ProductPicker
									open={isProductPickerOpen}
									onOpenChange={setIsProductPickerOpen}
									selectedIds={productIds}
									onSelectionChange={(ids) => pField.handleChange(ids)}
								/>
							</>
						);
					}}
				</form.Field>
			</FieldGroup>

			<Separator />

			{/* ── Schedule ── */}
			<FieldGroup>
				<header className="flex flex-col">
					<h3 className="font-medium text-foreground text-sm">Programación</h3>
					<FieldDescription>Fechas opcionales de inicio y fin de la oferta.</FieldDescription>
				</header>

				<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
					<form.Field name="startsAt">
						{(field) => (
							<Field className="flex-1">
								<FieldLabel htmlFor={field.name}>Fecha de inicio</FieldLabel>
								<DateTimePicker
									id={field.name}
									value={field.state.value}
									onChange={field.handleChange}
									placeholder="Selecciona fecha y hora"
									disabled={isSubmitting}
								/>
							</Field>
						)}
					</form.Field>

					<form.Field name="endsAt">
						{(field) => (
							<Field className="flex-1">
								<FieldLabel htmlFor={field.name}>Fecha de fin</FieldLabel>
								<DateTimePicker
									id={field.name}
									value={field.state.value}
									onChange={field.handleChange}
									placeholder="Selecciona fecha y hora"
									disabled={isSubmitting}
								/>
							</Field>
						)}
					</form.Field>
				</div>
			</FieldGroup>

			<Separator />

			{/* ── Flags ── */}
			<div className="flex flex-col gap-5 rounded-lg border p-4">
				<form.Field name="isActive">
					{(field) => (
						<Field orientation="horizontal" className="items-center justify-between gap-4">
							<div className="flex min-w-0 flex-col gap-1">
								<FieldLabel htmlFor={field.name} className="cursor-pointer">
									Oferta activa
								</FieldLabel>
								<FieldDescription>
									Las ofertas inactivas no se muestran en la tienda.
								</FieldDescription>
							</div>
							<Switch
								id={field.name}
								checked={field.state.value ?? true}
								onCheckedChange={(checked) => field.handleChange(checked)}
								disabled={isSubmitting}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field name="isFeatured">
					{(field) => (
						<Field orientation="horizontal" className="items-center justify-between gap-4">
							<div className="flex min-w-0 flex-col gap-1">
								<FieldLabel htmlFor={field.name} className="cursor-pointer">
									Oferta destacada
								</FieldLabel>
								<FieldDescription>Aparece en secciones destacadas de la tienda.</FieldDescription>
							</div>
							<Switch
								id={field.name}
								checked={field.state.value ?? false}
								onCheckedChange={(checked) => field.handleChange(checked)}
								disabled={isSubmitting}
							/>
						</Field>
					)}
				</form.Field>
			</div>
		</form>
	);
}
