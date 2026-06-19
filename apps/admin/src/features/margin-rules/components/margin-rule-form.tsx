import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@renovabit/ui/components/ui/field";
import { Input } from "@renovabit/ui/components/ui/input";
import { useForm } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import { getFieldErrorId, normalizeFieldErrors } from "@/shared/lib/form/form-utils";
import { MARGIN_PERCENT_MAX, type MarginRuleFormValues, marginRuleFormSchema } from "../validators";

// ── Constants ────────────────────────────────────────────

export const MARGIN_RULE_FORM_ID = "margin-rule-form";

// ── Props ────────────────────────────────────────────────

interface MarginRuleFormCreateProps {
	mode?: "create";
	defaultValues: MarginRuleFormValues;
	onMutation: (data: MarginRuleFormValues) => Promise<unknown>;
	onSuccess: () => void;
	onSubmittingChange?: (isSubmitting: boolean) => void;
	children?: React.ReactNode;
}

interface MarginRuleFormEditProps {
	mode: "edit";
	marginRule: {
		id: string;
		name: string;
		minPrice: string;
		maxPrice: string | null;
		customerPct: string;
		distributorPct: string;
		sortOrder: number;
	};
	onMutation: (data: MarginRuleFormValues) => Promise<unknown>;
	onSuccess: () => void;
	onSubmittingChange?: (isSubmitting: boolean) => void;
	children?: React.ReactNode;
}

export type MarginRuleFormProps = MarginRuleFormCreateProps | MarginRuleFormEditProps;

// ── Component ────────────────────────────────────────────

export function MarginRuleForm(props: MarginRuleFormProps) {
	const { onMutation, onSuccess } = props;
	const isEdit = props.mode === "edit";

	const defaultValues: MarginRuleFormValues = isEdit
		? {
				name: props.marginRule.name,
				minPrice: Number.parseFloat(props.marginRule.minPrice),
				maxPrice: props.marginRule.maxPrice ? Number.parseFloat(props.marginRule.maxPrice) : null,
				customerPct: Number.parseFloat(props.marginRule.customerPct),
				distributorPct: Number.parseFloat(props.marginRule.distributorPct),
				sortOrder: props.marginRule.sortOrder,
			}
		: props.defaultValues;

	const [isSubmitting, setIsSubmitting] = useState(false);
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
			onChange: marginRuleFormSchema,
			onSubmit: marginRuleFormSchema,
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
			id={MARGIN_RULE_FORM_ID}
			className="flex flex-col gap-5"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			noValidate
		>
			<FieldGroup>
				<form.Field name="name">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(MARGIN_RULE_FORM_ID, field.name);

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
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Ej: Tiers bajos, Medios, Premium"
									disabled={isSubmitting}
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

				<div className="flex flex-col gap-4">
					<form.Field name="minPrice">
						{(field) => {
							const wasSubmitted = field.form.state.submissionAttempts > 0;
							const isInvalid =
								(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
							const errorMessageId = getFieldErrorId(MARGIN_RULE_FORM_ID, field.name);

							return (
								<Field className="flex-1" data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										<span>
											Precio mínimo (S/){" "}
											<span aria-hidden="true" className="text-destructive">
												*
											</span>
											<span className="sr-only">obligatorio</span>
										</span>
									</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="number"
										min={0}
										step={0.01}
										value={field.state.value}
										onChange={(e) => field.handleChange(Number.parseFloat(e.target.value) || 0)}
										onBlur={field.handleBlur}
										placeholder="0.00"
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

					<form.Field name="maxPrice">
						{(field) => {
							const wasSubmitted = field.form.state.submissionAttempts > 0;
							const isInvalid =
								(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
							const errorMessageId = getFieldErrorId(MARGIN_RULE_FORM_ID, field.name);
							const val = field.state.value;
							return (
								<Field className="flex-1" data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Precio máximo (S/)</FieldLabel>
									<FieldDescription>Opcional. Dejar vacío = sin límite superior.</FieldDescription>
									<Input
										id={field.name}
										name={field.name}
										type="number"
										min={0}
										step={0.01}
										value={val === null ? "" : val}
										onChange={(e) => {
											const v = e.target.value;
											field.handleChange(v === "" ? null : Number.parseFloat(v));
										}}
										onBlur={field.handleBlur}
										placeholder="Sin límite"
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

				{/* ── Margins (one row per role) ── */}
				<FieldGroup>
					<header className="flex flex-col">
						<h3 className="font-medium text-foreground text-sm">Márgenes</h3>
						<FieldDescription>
							Porcentaje de ganancia por rol para el rango de precio. Admin no usa reglas (siempre
							ve el precio de costo).
						</FieldDescription>
					</header>

					<div className="grid gap-4 sm:grid-cols-2">
						<form.Field name="customerPct">
							{(field) => {
								const wasSubmitted = field.form.state.submissionAttempts > 0;
								const isInvalid =
									(field.state.meta.isTouched || wasSubmitted) &&
									field.state.meta.errors.length > 0;
								const errorMessageId = getFieldErrorId(MARGIN_RULE_FORM_ID, field.name);

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>
											<span>
												Margen cliente (%){" "}
												<span aria-hidden="true" className="text-destructive">
													*
												</span>
												<span className="sr-only">obligatorio</span>
											</span>
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											type="number"
											min={0}
											max={MARGIN_PERCENT_MAX}
											step={0.01}
											value={field.state.value}
											onChange={(e) => field.handleChange(Number.parseFloat(e.target.value) || 0)}
											onBlur={field.handleBlur}
											placeholder="20"
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

						<form.Field name="distributorPct">
							{(field) => {
								const wasSubmitted = field.form.state.submissionAttempts > 0;
								const isInvalid =
									(field.state.meta.isTouched || wasSubmitted) &&
									field.state.meta.errors.length > 0;
								const errorMessageId = getFieldErrorId(MARGIN_RULE_FORM_ID, field.name);

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>
											<span>
												Margen distribuidor (%){" "}
												<span aria-hidden="true" className="text-destructive">
													*
												</span>
												<span className="sr-only">obligatorio</span>
											</span>
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											type="number"
											min={0}
											max={MARGIN_PERCENT_MAX}
											step={0.01}
											value={field.state.value}
											onChange={(e) => field.handleChange(Number.parseFloat(e.target.value) || 0)}
											onBlur={field.handleBlur}
											placeholder="10"
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

				<form.Field name="sortOrder">
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>Orden</FieldLabel>
							<FieldDescription>Menor = primero en la evaluación.</FieldDescription>
							<Input
								id={field.name}
								name={field.name}
								type="number"
								min={0}
								step={1}
								value={field.state.value}
								onChange={(e) => field.handleChange(Number.parseInt(e.target.value, 10) || 0)}
								disabled={isSubmitting}
							/>
						</Field>
					)}
				</form.Field>
			</FieldGroup>

			{props.children}
		</form>
	);
}
