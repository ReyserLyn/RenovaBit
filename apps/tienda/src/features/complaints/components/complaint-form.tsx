import {
	CheckmarkCircle02Icon,
	Copy01Icon,
	InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Alert,
	AlertContent,
	AlertDescription,
	AlertIcon,
	AlertTitle,
} from "@renovabit/ui/components/ui/alert";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@renovabit/ui/components/ui/card";
import { Checkbox } from "@renovabit/ui/components/ui/checkbox";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@renovabit/ui/components/ui/field";
import { Input } from "@renovabit/ui/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@renovabit/ui/components/ui/select";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { Spinner } from "@renovabit/ui/components/ui/spinner";
import { Textarea } from "@renovabit/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { WhatsAppIcon } from "@/shared/components/icons";
import { ApiClientError } from "@/shared/lib/api";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import { copyText } from "@/shared/lib/clipboard";
import { buildWhatsAppUrl, WHATSAPP_DISPLAY } from "@/shared/lib/contact";
import { getFieldErrorId, normalizeFieldErrors } from "@/shared/lib/form/form-utils";
import { useCreateComplaint } from "../hooks/mutations";
import {
	COMPLAINT_TYPE_OPTIONS,
	type ComplaintFormValues,
	complaintSchema,
	DOC_TYPE_OPTIONS,
} from "../model";

const FORM_ID = "complaint-form";

const DEFAULT_VALUES: ComplaintFormValues = {
	type: "reclamo",
	fullName: "",
	docType: "DNI",
	docNumber: "",
	email: "",
	phone: "",
	address: "",
	orderNumber: "",
	isMinor: false,
	guardianName: "",
	guardianDocNumber: "",
	description: "",
	request: "",
};

function isComplaintType(value: string): value is ComplaintFormValues["type"] {
	return value === "reclamo" || value === "queja";
}

function isDocType(value: string): value is ComplaintFormValues["docType"] {
	return DOC_TYPE_OPTIONS.some((option) => option.value === value);
}

/** Prevents the same error from being rendered twice (hook toast + inline). */
function getInlineError(error: unknown): string | null {
	if (!error) return null;
	if (error instanceof ApiClientError && error.code === "RATE_LIMITED") {
		return "Demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.";
	}
	return resolveErrorMessage(error);
}

export function ComplaintForm() {
	const createComplaint = useCreateComplaint();
	const [createdCode, setCreatedCode] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const form = useForm({
		defaultValues: DEFAULT_VALUES,
		validators: {
			onChange: complaintSchema,
			onSubmit: complaintSchema,
		},
		onSubmit: async ({ value }) => {
			const complaint = await createComplaint.mutateAsync({
				type: value.type,
				fullName: value.fullName.trim(),
				docType: value.docType,
				docNumber: value.docNumber.trim(),
				email: value.email.trim(),
				phone: value.phone.trim(),
				address: value.address.trim(),
				orderNumber: value.orderNumber.trim() ? value.orderNumber.trim() : null,
				isMinor: value.isMinor,
				guardianName: value.isMinor ? value.guardianName.trim() : null,
				guardianDocNumber: value.isMinor ? value.guardianDocNumber.trim() : null,
				description: value.description.trim(),
				request: value.request.trim(),
			});
			setCreatedCode(complaint.code);
		},
	});

	const inlineError = getInlineError(createComplaint.error);

	if (createdCode) {
		const waUrl = buildWhatsAppUrl({
			message: `Hola, registré la hoja de reclamación ${createdCode} en el Libro de Reclamaciones virtual y quisiera darle seguimiento.`,
		});

		return (
			<Card className="w-full">
				<CardHeader className="items-center text-center">
					<div className="bg-success/10 text-success mx-auto flex size-14 items-center justify-center rounded-full">
						<HugeiconsIcon icon={CheckmarkCircle02Icon} size={28} strokeWidth={1.5} />
					</div>
					<CardTitle className="text-xl">Hoja registrada</CardTitle>
					<CardDescription>
						Tu reclamo o queja quedó registrado. Recibirás respuesta en un máximo de 15 días hábiles
						improrrogables, según lo establecido en el Código de Protección y Defensa del
						Consumidor.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col items-center gap-4">
					<div className="bg-muted/50 flex w-full flex-col items-center gap-1 rounded-lg border px-4 py-4">
						<span className="text-muted-foreground text-xs uppercase tracking-wider">
							Código de tu hoja
						</span>
						<span className="font-mono text-2xl font-bold tracking-tight">{createdCode}</span>
					</div>

					<div className="flex w-full flex-col gap-2 sm:flex-row">
						<Button
							variant="outline"
							size="lg"
							className="flex-1"
							onClick={() =>
								copyText(createdCode, {
									label: "Código",
									onSuccess: () => {
										setCopied(true);
										setTimeout(() => setCopied(false), 1500);
									},
								})
							}
						>
							<HugeiconsIcon icon={Copy01Icon} size={16} className={copied ? "text-success" : ""} />
							{copied ? "Copiado" : "Copiar código"}
						</Button>
						<Button
							size="lg"
							className="flex-1 border-[#25D366] bg-[#25D366] text-white hover:bg-[#25D366]/90 hover:text-white"
							nativeButton={false}
							render={
								<a href={waUrl} target="_blank" rel="noopener noreferrer">
									<WhatsAppIcon className="size-5" />
									Dar seguimiento
								</a>
							}
						/>
					</div>

					<Alert appearance="light" variant="info" size="md" className="w-full">
						<AlertIcon>
							<HugeiconsIcon icon={InformationCircleIcon} size={18} strokeWidth={1.5} />
						</AlertIcon>
						<AlertContent>
							<AlertTitle>Guarda tu código</AlertTitle>
							<AlertDescription>
								Conserva el código para cualquier consulta. También puedes escribirnos por WhatsApp
								al {WHATSAPP_DISPLAY}.
							</AlertDescription>
						</AlertContent>
					</Alert>

					<Button
						variant="ghost"
						onClick={() => {
							form.reset();
							setCreatedCode(null);
						}}
					>
						Registrar otra hoja
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>Hoja de reclamación virtual</CardTitle>
				<CardDescription>
					Completa el formulario con tus datos. Los campos marcados con * son obligatorios.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id={FORM_ID}
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						form.handleSubmit();
					}}
				>
					{inlineError && (
						<Alert appearance="light" variant="destructive" size="md" className="mb-5">
							<AlertIcon>
								<HugeiconsIcon icon={InformationCircleIcon} size={18} strokeWidth={1.5} />
							</AlertIcon>
							<AlertContent>
								<AlertTitle>No pudimos registrar tu hoja</AlertTitle>
								<AlertDescription>{inlineError}</AlertDescription>
							</AlertContent>
						</Alert>
					)}

					<FieldGroup className="gap-5">
						{/* ── Tipo ─────────────────────────── */}
						<form.Field name="type">
							{(field) => (
								<Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
									<FieldLabel htmlFor={field.name}>Tipo de solicitud *</FieldLabel>
									<Select
										items={COMPLAINT_TYPE_OPTIONS}
										value={field.state.value}
										onValueChange={(value) => {
											if (typeof value === "string" && isComplaintType(value)) {
												field.handleChange(value);
											}
										}}
									>
										<SelectTrigger id={field.name} className="w-full">
											<SelectValue placeholder="Seleccionar tipo" />
										</SelectTrigger>
										<SelectContent>
											{COMPLAINT_TYPE_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FieldDescription>
										{
											COMPLAINT_TYPE_OPTIONS.find((option) => option.value === field.state.value)
												?.hint
										}
									</FieldDescription>
								</Field>
							)}
						</form.Field>

						{/* ── Nombre ───────────────────────── */}
						<form.Field name="fullName">
							{(field) => {
								const wasSubmitted = field.form.state.submissionAttempts > 0;
								const isInvalid =
									(field.state.meta.isTouched || wasSubmitted) &&
									field.state.meta.errors.length > 0;
								const errorId = getFieldErrorId(FORM_ID, field.name);
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Nombre completo *</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											autoComplete="name"
											disabled={createComplaint.isPending}
											aria-invalid={isInvalid}
											aria-describedby={isInvalid ? errorId : undefined}
										/>
										{isInvalid && (
											<FieldError
												id={errorId}
												errors={normalizeFieldErrors(field.state.meta.errors)}
											/>
										)}
									</Field>
								);
							}}
						</form.Field>

						{/* ── Documento ────────────────────── */}
						<div className="grid gap-5 sm:grid-cols-2">
							<form.Field name="docType">
								{(field) => (
									<Field>
										<FieldLabel htmlFor={field.name}>Tipo de documento *</FieldLabel>
										<Select
											items={DOC_TYPE_OPTIONS}
											value={field.state.value}
											onValueChange={(value) => {
												if (typeof value === "string" && isDocType(value)) {
													field.handleChange(value);
												}
											}}
										>
											<SelectTrigger id={field.name} className="w-full">
												<SelectValue placeholder="Seleccionar documento" />
											</SelectTrigger>
											<SelectContent>
												{DOC_TYPE_OPTIONS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
								)}
							</form.Field>

							<form.Field name="docNumber">
								{(field) => {
									const wasSubmitted = field.form.state.submissionAttempts > 0;
									const isInvalid =
										(field.state.meta.isTouched || wasSubmitted) &&
										field.state.meta.errors.length > 0;
									const errorId = getFieldErrorId(FORM_ID, field.name);
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Número de documento *</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												autoComplete="off"
												disabled={createComplaint.isPending}
												aria-invalid={isInvalid}
												aria-describedby={isInvalid ? errorId : undefined}
											/>
											{isInvalid && (
												<FieldError
													id={errorId}
													errors={normalizeFieldErrors(field.state.meta.errors)}
												/>
											)}
										</Field>
									);
								}}
							</form.Field>
						</div>

						{/* ── Contacto ─────────────────────── */}
						<div className="grid gap-5 sm:grid-cols-2">
							<form.Field name="email">
								{(field) => {
									const wasSubmitted = field.form.state.submissionAttempts > 0;
									const isInvalid =
										(field.state.meta.isTouched || wasSubmitted) &&
										field.state.meta.errors.length > 0;
									const errorId = getFieldErrorId(FORM_ID, field.name);
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Correo electrónico *</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												type="email"
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												autoComplete="email"
												disabled={createComplaint.isPending}
												aria-invalid={isInvalid}
												aria-describedby={isInvalid ? errorId : undefined}
											/>
											{isInvalid && (
												<FieldError
													id={errorId}
													errors={normalizeFieldErrors(field.state.meta.errors)}
												/>
											)}
										</Field>
									);
								}}
							</form.Field>

							<form.Field name="phone">
								{(field) => {
									const wasSubmitted = field.form.state.submissionAttempts > 0;
									const isInvalid =
										(field.state.meta.isTouched || wasSubmitted) &&
										field.state.meta.errors.length > 0;
									const errorId = getFieldErrorId(FORM_ID, field.name);
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Teléfono *</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												type="tel"
												inputMode="tel"
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												autoComplete="tel"
												placeholder="999 999 999"
												disabled={createComplaint.isPending}
												aria-invalid={isInvalid}
												aria-describedby={isInvalid ? errorId : undefined}
											/>
											{isInvalid && (
												<FieldError
													id={errorId}
													errors={normalizeFieldErrors(field.state.meta.errors)}
												/>
											)}
										</Field>
									);
								}}
							</form.Field>
						</div>

						{/* ── Dirección ────────────────────── */}
						<form.Field name="address">
							{(field) => {
								const wasSubmitted = field.form.state.submissionAttempts > 0;
								const isInvalid =
									(field.state.meta.isTouched || wasSubmitted) &&
									field.state.meta.errors.length > 0;
								const errorId = getFieldErrorId(FORM_ID, field.name);
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Dirección *</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											autoComplete="street-address"
											disabled={createComplaint.isPending}
											aria-invalid={isInvalid}
											aria-describedby={isInvalid ? errorId : undefined}
										/>
										{isInvalid && (
											<FieldError
												id={errorId}
												errors={normalizeFieldErrors(field.state.meta.errors)}
											/>
										)}
									</Field>
								);
							}}
						</form.Field>

						{/* ── Pedido (opcional) ─────────────── */}
						<form.Field name="orderNumber">
							{(field) => (
								<Field>
									<FieldLabel htmlFor={field.name}>Número de pedido (opcional)</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										placeholder="Ej. ORD-2026-XXXXXXXXXX"
										disabled={createComplaint.isPending}
									/>
									<FieldDescription>
										Si tu reclamo está relacionado con un pedido, indícalo para agilizar la
										atención.
									</FieldDescription>
								</Field>
							)}
						</form.Field>

						{/* ── Menor de edad ─────────────────── */}
						<form.Field name="isMinor">
							{(field) => (
								<Field orientation="horizontal">
									<Checkbox
										id={field.name}
										checked={field.state.value}
										onCheckedChange={(checked) => field.handleChange(checked === true)}
										disabled={createComplaint.isPending}
									/>
									<FieldLabel htmlFor={field.name} className="cursor-pointer">
										El consumidor es menor de edad
									</FieldLabel>
								</Field>
							)}
						</form.Field>

						<form.Subscribe selector={(state) => state.values.isMinor}>
							{(isMinor) =>
								isMinor ? (
									<div className="grid gap-5 sm:grid-cols-2">
										<form.Field name="guardianName">
											{(field) => {
												const wasSubmitted = field.form.state.submissionAttempts > 0;
												const isInvalid =
													(field.state.meta.isTouched || wasSubmitted) &&
													field.state.meta.errors.length > 0;
												const errorId = getFieldErrorId(FORM_ID, field.name);
												return (
													<Field data-invalid={isInvalid}>
														<FieldLabel htmlFor={field.name}>
															Nombre del padre, madre o tutor *
														</FieldLabel>
														<Input
															id={field.name}
															name={field.name}
															value={field.state.value}
															onBlur={field.handleBlur}
															onChange={(event) => field.handleChange(event.target.value)}
															disabled={createComplaint.isPending}
															aria-invalid={isInvalid}
															aria-describedby={isInvalid ? errorId : undefined}
														/>
														{isInvalid && (
															<FieldError
																id={errorId}
																errors={normalizeFieldErrors(field.state.meta.errors)}
															/>
														)}
													</Field>
												);
											}}
										</form.Field>

										<form.Field name="guardianDocNumber">
											{(field) => {
												const wasSubmitted = field.form.state.submissionAttempts > 0;
												const isInvalid =
													(field.state.meta.isTouched || wasSubmitted) &&
													field.state.meta.errors.length > 0;
												const errorId = getFieldErrorId(FORM_ID, field.name);
												return (
													<Field data-invalid={isInvalid}>
														<FieldLabel htmlFor={field.name}>
															Documento del padre, madre o tutor *
														</FieldLabel>
														<Input
															id={field.name}
															name={field.name}
															value={field.state.value}
															onBlur={field.handleBlur}
															onChange={(event) => field.handleChange(event.target.value)}
															disabled={createComplaint.isPending}
															aria-invalid={isInvalid}
															aria-describedby={isInvalid ? errorId : undefined}
														/>
														{isInvalid && (
															<FieldError
																id={errorId}
																errors={normalizeFieldErrors(field.state.meta.errors)}
															/>
														)}
													</Field>
												);
											}}
										</form.Field>
									</div>
								) : null
							}
						</form.Subscribe>

						<Separator />

						{/* ── Detalle ──────────────────────── */}
						<form.Field name="description">
							{(field) => {
								const wasSubmitted = field.form.state.submissionAttempts > 0;
								const isInvalid =
									(field.state.meta.isTouched || wasSubmitted) &&
									field.state.meta.errors.length > 0;
								const errorId = getFieldErrorId(FORM_ID, field.name);
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Detalle del reclamo o queja *</FieldLabel>
										<Textarea
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											rows={5}
											placeholder="Describe lo ocurrido con el mayor detalle posible."
											disabled={createComplaint.isPending}
											aria-invalid={isInvalid}
											aria-describedby={isInvalid ? errorId : undefined}
										/>
										{isInvalid && (
											<FieldError
												id={errorId}
												errors={normalizeFieldErrors(field.state.meta.errors)}
											/>
										)}
									</Field>
								);
							}}
						</form.Field>

						<form.Field name="request">
							{(field) => {
								const wasSubmitted = field.form.state.submissionAttempts > 0;
								const isInvalid =
									(field.state.meta.isTouched || wasSubmitted) &&
									field.state.meta.errors.length > 0;
								const errorId = getFieldErrorId(FORM_ID, field.name);
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>¿Qué solicitas? *</FieldLabel>
										<Textarea
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											rows={4}
											placeholder="Indica qué solución esperas (cambio, devolución, revisión técnica, etc.)."
											disabled={createComplaint.isPending}
											aria-invalid={isInvalid}
											aria-describedby={isInvalid ? errorId : undefined}
										/>
										{isInvalid && (
											<FieldError
												id={errorId}
												errors={normalizeFieldErrors(field.state.meta.errors)}
											/>
										)}
									</Field>
								);
							}}
						</form.Field>

						<div className="space-y-3">
							<Button
								type="submit"
								size="xl"
								className="w-full"
								disabled={createComplaint.isPending}
								aria-busy={createComplaint.isPending}
							>
								{createComplaint.isPending ? (
									<>
										<Spinner data-icon="inline-start" aria-hidden />
										<span>Registrando...</span>
									</>
								) : (
									"Registrar hoja"
								)}
							</Button>
							<p className="text-muted-foreground text-center text-xs">
								Al registrar la hoja declaras que la información proporcionada es veraz. La
								respuesta se enviará al correo indicado en un plazo máximo de 15 días hábiles
								improrrogables.
							</p>
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
