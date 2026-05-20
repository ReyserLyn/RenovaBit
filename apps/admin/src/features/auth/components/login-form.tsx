import { PasswordInput } from "@renovabit/ui/components/form";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@renovabit/ui/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@renovabit/ui/components/ui/field";
import { Input } from "@renovabit/ui/components/ui/input";
import { Spinner } from "@renovabit/ui/components/ui/spinner";
import { useForm } from "@tanstack/react-form";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { getAuthMessage } from "@/lib/auth/auth-error-messages";
import { getFieldErrorId, normalizeFieldErrors } from "@/lib/form/form-utils";
import { useLogin } from "../hooks/use-login";
import { loginSchema } from "../model";

const LOGIN_FORM_ID = "login-form";

export function LoginForm() {
	const navigate = useNavigate();
	const router = useRouter();
	const loginMutation = useLogin();

	const loginErrorMessage = loginMutation.error ? getAuthMessage(loginMutation.error) : null;
	const errorRef = useRef<HTMLDivElement>(null);
	const hasError = Boolean(loginErrorMessage);
	const isPending = loginMutation.isPending;

	const form = useForm({
		defaultValues: {
			emailOrUsername: "",
			password: "",
		},
		validators: {
			onChange: loginSchema,
			onSubmit: loginSchema,
		},
		onSubmit: async ({ value }) => {
			await loginMutation.mutateAsync(value);
			void router.invalidate();
			void navigate({ to: "/" });
		},
	});

	useEffect(() => {
		if (hasError) {
			errorRef.current?.focus();
		}
	}, [hasError]);

	return (
		<Card className="w-full border-border/70 bg-card/95 shadow-xl transition-shadow duration-200 focus-within:shadow-2xl p-6 sm:p-8">
			<CardHeader className="flex flex-col gap-3 pb-2 text-center">
				<CardTitle className="text-2xl sm:text-3xl font-semibold tracking-tight">
					Iniciar sesión
				</CardTitle>
				<CardDescription className="text-muted-foreground/90">
					Accede al panel para gestionar productos, marcas y categorías de tu tienda.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				<form
					id={LOGIN_FORM_ID}
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					noValidate
					aria-describedby={hasError ? "login-error" : undefined}
					className="flex flex-col gap-5"
				>
					{hasError && (
						<div
							id="login-error"
							ref={errorRef}
							role="alert"
							aria-live="polite"
							tabIndex={-1}
							className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
						>
							{loginErrorMessage}
						</div>
					)}

					<form.Field name="emailOrUsername">
						{(field) => {
							const wasSubmitted = field.form.state.submissionAttempts > 0;
							const isInvalid =
								(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
							const errorMessageId = getFieldErrorId("login-form", field.name);

							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										Correo o usuario
										<span aria-label="obligatorio" className="text-destructive ml-0.5">
											*
										</span>
									</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="text"
										autoComplete="username email"
										placeholder="correo@ejemplo.com o usuario"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										disabled={isPending}
										spellCheck={false}
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

					<form.Field name="password">
						{(field) => {
							const wasSubmitted = field.form.state.submissionAttempts > 0;
							const isInvalid =
								(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
							const errorMessageId = getFieldErrorId("login-form", field.name);

							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										Contraseña
										<span aria-label="obligatorio" className="text-destructive ml-0.5">
											*
										</span>
									</FieldLabel>
									<PasswordInput
										id={field.name}
										name={field.name}
										autoComplete="current-password"
										placeholder="••••••••"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										disabled={isPending}
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

					<FieldGroup>
						<Field orientation="horizontal" className="w-full">
							<Button
								type="submit"
								form={LOGIN_FORM_ID}
								size="lg"
								className="w-full"
								disabled={isPending}
								aria-busy={isPending}
							>
								{isPending ? (
									<>
										<Spinner data-icon="inline-start" aria-hidden />
										<span>Iniciando sesión...</span>
									</>
								) : (
									"Entrar"
								)}
							</Button>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
