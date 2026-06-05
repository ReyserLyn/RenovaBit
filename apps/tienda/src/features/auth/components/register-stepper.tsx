import { PasswordInput } from "@renovabit/ui/components/form";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@renovabit/ui/components/ui/card";
import { Field, FieldError, FieldLabel } from "@renovabit/ui/components/ui/field";
import { Input } from "@renovabit/ui/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@renovabit/ui/components/ui/input-group";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { Spinner } from "@renovabit/ui/components/ui/spinner";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PeruIcon } from "@/shared/components/icons/peru-icon";
import {
	Stepper,
	StepperContent,
	StepperIndicator,
	StepperItem,
	StepperNav,
	StepperPanel,
	StepperSeparator,
	StepperTitle,
	StepperTrigger,
} from "@/shared/components/ui/stepper";
import { getAuthMessage } from "@/shared/lib/auth/auth-error-messages";
import { useRegister } from "../hooks/use-register";
import { type Step1Values, type Step2Values, step1Schema, step2Schema } from "../model";
import { LoginWithGoogle } from "./login-with-google";

// ── Constants ────────────────────────────────────────

const REGISTER_FORM_ID = "register-stepper-form";

const FIELD_KEY_RE = /^step[12]\./;

const STEPS = [
	{ step: 1, title: "Datos" },
	{ step: 2, title: "Seguridad" },
] as const;

// ── Helpers (outside component — pure, no closure) ───

function Asterisk() {
	return (
		<>
			{" "}
			<span aria-hidden="true" className="text-destructive">
				*
			</span>
			<span className="sr-only">obligatorio</span>
		</>
	);
}

function fieldErrorId(fieldName: string): string {
	return `${REGISTER_FORM_ID}-${fieldName}-error`;
}

/** Runs Zod safeParse, returns Map<fieldName, messages> or null if valid */
function mapZodErrors<T>(
	schema: {
		safeParse: (data: T) => {
			success: boolean;
			error?: { issues: Array<{ path: PropertyKey[]; message: string }> };
		};
	},
	data: T,
): Map<string, string[]> | null {
	const result = schema.safeParse(data);
	if (result.success) return null;

	const fieldErrors = new Map<string, string[]>();
	for (const issue of result.error?.issues ?? []) {
		const key = issue.path.map(String).join(".");
		const list = fieldErrors.get(key) ?? [];
		list.push(issue.message);
		fieldErrors.set(key, list);
	}
	return fieldErrors;
}

// ── Component ────────────────────────────────────────

export function RegisterStepper() {
	const navigate = useNavigate();
	const router = useRouter();
	const registerMutation = useRegister();

	const [step, setStep] = useState(1);
	const [step1Submitted, setStep1Submitted] = useState(false);
	const [step2Submitted, setStep2Submitted] = useState(false);
	const [step1Errors, setStep1Errors] = useState<Map<string, string[]>>(new Map());
	const [step2Errors, setStep2Errors] = useState<Map<string, string[]>>(new Map());

	// ── Form ──────────────────────────────────────────

	const form = useForm({
		defaultValues: {
			step1: { name: "", lastname: "", phone: "", email: "", username: "" },
			step2: { password: "", confirmPassword: "" },
		},
		onSubmit: async ({ value }) => {
			const s1 = readStep1();
			const s2 = readStep2();
			await registerMutation.mutateAsync({
				name: s1.name,
				lastname: s1.lastname,
				phone: s1.phone || undefined,
				email: s1.email,
				username: s1.username || undefined,
				password: s2.password,
			});
			void router.invalidate();
			void navigate({ to: "/" });
		},
	});

	// ── Data readers ──────────────────────────────────

	function readStep1(): Step1Values {
		const s = form.state.values.step1;
		return {
			name: s.name,
			lastname: s.lastname,
			phone: s.phone,
			email: s.email,
			username: s.username,
		};
	}

	function readStep2(): Step2Values {
		const s = form.state.values.step2;
		return { password: s.password, confirmPassword: s.confirmPassword };
	}

	// ── Validation ────────────────────────────────────

	/** Validates a step and updates its error map. Returns the errors map or null. */
	function revalidate(stepNum: 1 | 2): Map<string, string[]> | null {
		const errors = mapZodErrors(
			stepNum === 1 ? step1Schema : step2Schema,
			stepNum === 1 ? readStep1() : readStep2(),
		);
		if (stepNum === 1) setStep1Errors(errors ?? new Map());
		else setStep2Errors(errors ?? new Map());
		return errors;
	}

	function handleStep1(e: React.SyntheticEvent) {
		e.preventDefault();
		e.stopPropagation();
		const errors = revalidate(1);
		if (errors) {
			setStep1Submitted(true);
			return;
		}
		setStep1Errors(new Map());
		setStep1Submitted(false);
		setStep(2);
	}

	function handleStep2(e: React.SyntheticEvent) {
		e.preventDefault();
		e.stopPropagation();

		if (revalidate(2)) {
			setStep2Submitted(true);
			return;
		}
		if (revalidate(1)) {
			setStep1Submitted(true);
			setStep(1);
			return;
		}

		setStep2Errors(new Map());
		setStep2Submitted(false);
		form.handleSubmit();
	}

	// ── Error display ─────────────────────────────────

	function fieldErrors(
		fieldName: string,
		isTouched: boolean,
		submitted: boolean,
		zodErrors: Map<string, string[]>,
	): Array<{ message: string }> | null {
		const msgs = zodErrors.get(fieldName.replace(FIELD_KEY_RE, ""));
		if (msgs && (isTouched || submitted)) return msgs.map((msg) => ({ message: msg }));
		return null;
	}

	// ── Derived state ─────────────────────────────────

	const isPending = registerMutation.isPending;
	const serverError = registerMutation.error ? getAuthMessage(registerMutation.error) : null;
	const errorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (serverError) errorRef.current?.focus();
	}, [serverError]);

	// ── Render ────────────────────────────────────────

	return (
		<Card className="w-full sm:p-8 p-6">
			<CardHeader className="flex flex-col items-center gap-3 pb-2 text-center">
				<CardTitle className="text-2xl sm:text-3xl font-semibold">Crear cuenta</CardTitle>
				<CardDescription>Completa los pasos para registrarte en Renovabit.</CardDescription>
			</CardHeader>

			<CardContent className="flex flex-col gap-5 px-0">
				<LoginWithGoogle />

				<div className="flex w-full items-center gap-2">
					<Separator className="h-px flex-1" />
					<span className="text-muted-foreground text-xs font-medium">O</span>
					<Separator className="h-px flex-1" />
				</div>

				{serverError && (
					<div
						ref={errorRef}
						role="alert"
						aria-live="polite"
						tabIndex={-1}
						className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
					>
						{serverError}
					</div>
				)}

				<Stepper value={step} onValueChange={setStep} orientation="horizontal">
					<StepperNav className="mb-6">
						{STEPS.map((s, idx) => (
							<StepperItem
								key={s.step}
								step={s.step}
								completed={s.step === 1 ? !step1Submitted && step >= 2 : false}
								disabled={s.step === 2 && step !== 2}
								className="gap-0"
							>
								<StepperTrigger className="flex-col gap-1.5">
									<StepperIndicator>{s.step}</StepperIndicator>
									<StepperTitle className="hidden text-[10px] font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=completed]:text-foreground sm:block">
										{s.title}
									</StepperTitle>
								</StepperTrigger>
								{idx < STEPS.length - 1 && <StepperSeparator className="mx-1" />}
							</StepperItem>
						))}
					</StepperNav>

					<StepperPanel>
						{/* ═══════════════════════════════════ */}
						{/*  STEP 1 — Datos personales         */}
						{/* ═══════════════════════════════════ */}
						<StepperContent value={1} forceMount>
							<form onSubmit={handleStep1} noValidate className="flex flex-col gap-5">
								{/* Name + Lastname — side by side */}
								<div className="flex flex-col gap-4 sm:flex-row">
									<div className="flex-1">
										<form.Field name="step1.name">
											{(field) => {
												const errs = fieldErrors(
													field.name,
													field.state.meta.isTouched,
													step1Submitted,
													step1Errors,
												);
												const invalid = errs !== null;
												return (
													<Field data-invalid={invalid}>
														<FieldLabel htmlFor={field.name}>
															<span>
																Nombres
																<Asterisk />
															</span>
														</FieldLabel>
														<Input
															id={field.name}
															name={field.name}
															type="text"
															autoComplete="given-name"
															placeholder="Nombres"
															value={field.state.value}
															onBlur={field.handleBlur}
															onChange={(e) => {
																field.handleChange(e.target.value);
																revalidate(1);
															}}
															aria-invalid={invalid}
															aria-describedby={invalid ? fieldErrorId(field.name) : undefined}
														/>
														{invalid && <FieldError id={fieldErrorId(field.name)} errors={errs} />}
													</Field>
												);
											}}
										</form.Field>
									</div>

									<div className="flex-1">
										<form.Field name="step1.lastname">
											{(field) => {
												const errs = fieldErrors(
													field.name,
													field.state.meta.isTouched,
													step1Submitted,
													step1Errors,
												);
												const invalid = errs !== null;
												return (
													<Field data-invalid={invalid}>
														<FieldLabel htmlFor={field.name}>
															<span>
																Apellidos
																<Asterisk />
															</span>
														</FieldLabel>
														<Input
															id={field.name}
															name={field.name}
															type="text"
															autoComplete="family-name"
															placeholder="Apellidos"
															value={field.state.value}
															onBlur={field.handleBlur}
															onChange={(e) => {
																field.handleChange(e.target.value);
																revalidate(1);
															}}
															aria-invalid={invalid}
															aria-describedby={invalid ? fieldErrorId(field.name) : undefined}
														/>
														{invalid && <FieldError id={fieldErrorId(field.name)} errors={errs} />}
													</Field>
												);
											}}
										</form.Field>
									</div>
								</div>

								{/* Phone */}
								<form.Field name="step1.phone">
									{(field) => {
										const errs = fieldErrors(
											field.name,
											field.state.meta.isTouched,
											step1Submitted,
											step1Errors,
										);
										const invalid = errs !== null;
										return (
											<Field data-invalid={invalid}>
												<FieldLabel htmlFor={field.name}>Teléfono</FieldLabel>
												<InputGroup>
													<InputGroupAddon>
														<PeruIcon className="size-4" />
														<span className="text-xs">+51</span>
													</InputGroupAddon>
													<InputGroupInput
														id={field.name}
														name={field.name}
														type="tel"
														autoComplete="tel"
														placeholder="999 999 999"
														maxLength={9}
														inputMode="numeric"
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => {
															field.handleChange(e.target.value.replace(/\D/g, ""));
															revalidate(1);
														}}
														aria-invalid={invalid}
														aria-describedby={invalid ? fieldErrorId(field.name) : undefined}
													/>
												</InputGroup>
												{invalid && <FieldError id={fieldErrorId(field.name)} errors={errs} />}
											</Field>
										);
									}}
								</form.Field>

								{/* Email */}
								<form.Field name="step1.email">
									{(field) => {
										const errs = fieldErrors(
											field.name,
											field.state.meta.isTouched,
											step1Submitted,
											step1Errors,
										);
										const invalid = errs !== null;
										return (
											<Field data-invalid={invalid}>
												<FieldLabel htmlFor={field.name}>
													<span>
														Correo electrónico
														<Asterisk />
													</span>
												</FieldLabel>
												<Input
													id={field.name}
													name={field.name}
													type="email"
													autoComplete="email"
													placeholder="correo@ejemplo.com"
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => {
														field.handleChange(e.target.value);
														revalidate(1);
													}}
													spellCheck={false}
													aria-invalid={invalid}
													aria-describedby={invalid ? fieldErrorId(field.name) : undefined}
												/>
												{invalid && <FieldError id={fieldErrorId(field.name)} errors={errs} />}
											</Field>
										);
									}}
								</form.Field>

								{/* Username */}
								<form.Field name="step1.username">
									{(field) => {
										const errs = fieldErrors(
											field.name,
											field.state.meta.isTouched,
											step1Submitted,
											step1Errors,
										);
										const invalid = errs !== null;
										return (
											<Field data-invalid={invalid}>
												<FieldLabel htmlFor={field.name}>Nombre de usuario</FieldLabel>
												<Input
													id={field.name}
													name={field.name}
													type="text"
													autoComplete="username"
													placeholder="usuario"
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => {
														field.handleChange(
															e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
														);
														revalidate(1);
													}}
													spellCheck={false}
													aria-invalid={invalid}
													aria-describedby={invalid ? fieldErrorId(field.name) : undefined}
												/>
												{invalid && <FieldError id={fieldErrorId(field.name)} errors={errs} />}
											</Field>
										);
									}}
								</form.Field>

								<div className="flex items-center justify-end gap-4">
									<Button type="submit" size="lg">
										Continuar
									</Button>
								</div>
							</form>
						</StepperContent>

						{/* ═══════════════════════════════════ */}
						{/*  STEP 2 — Contraseña               */}
						{/* ═══════════════════════════════════ */}
						<StepperContent value={2} forceMount>
							<form onSubmit={handleStep2} noValidate className="flex flex-col gap-5">
								{/* Password */}
								<form.Field name="step2.password">
									{(field) => {
										const errs = fieldErrors(
											field.name,
											field.state.meta.isTouched,
											step2Submitted,
											step2Errors,
										);
										const invalid = errs !== null;
										return (
											<Field data-invalid={invalid}>
												<FieldLabel htmlFor={field.name}>
													<span>
														Contraseña
														<Asterisk />
													</span>
												</FieldLabel>
												<PasswordInput
													id={field.name}
													name={field.name}
													autoComplete="new-password"
													placeholder="••••••••"
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => {
														field.handleChange(e.target.value);
														revalidate(2);
													}}
													aria-invalid={invalid}
													aria-describedby={invalid ? fieldErrorId(field.name) : undefined}
												/>
												{invalid && <FieldError id={fieldErrorId(field.name)} errors={errs} />}
											</Field>
										);
									}}
								</form.Field>

								{/* Confirm password */}
								<form.Field name="step2.confirmPassword">
									{(field) => {
										const errs = fieldErrors(
											field.name,
											field.state.meta.isTouched,
											step2Submitted,
											step2Errors,
										);
										const invalid = errs !== null;
										return (
											<Field data-invalid={invalid}>
												<FieldLabel htmlFor={field.name}>
													<span>
														Confirmar contraseña
														<Asterisk />
													</span>
												</FieldLabel>
												<PasswordInput
													id={field.name}
													name={field.name}
													autoComplete="new-password"
													placeholder="••••••••"
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => {
														field.handleChange(e.target.value);
														revalidate(2);
													}}
													aria-invalid={invalid}
													aria-describedby={invalid ? fieldErrorId(field.name) : undefined}
												/>
												{invalid && <FieldError id={fieldErrorId(field.name)} errors={errs} />}
											</Field>
										);
									}}
								</form.Field>

								<div className="flex items-center justify-between gap-4">
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setStep2Submitted(false);
											setStep(1);
										}}
									>
										Atrás
									</Button>
									<Button type="submit" size="lg" disabled={isPending} aria-busy={isPending}>
										{isPending ? (
											<>
												<Spinner data-icon="inline-start" aria-hidden />
												Creando cuenta...
											</>
										) : (
											"Crear cuenta"
										)}
									</Button>
								</div>
							</form>
						</StepperContent>
					</StepperPanel>
				</Stepper>

				<p className="text-center text-sm">
					¿Ya tienes una cuenta?{" "}
					<Link
						to="/iniciar-sesion"
						className="text-muted-foreground underline transition-colors hover:text-foreground"
					>
						Iniciar sesión
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
