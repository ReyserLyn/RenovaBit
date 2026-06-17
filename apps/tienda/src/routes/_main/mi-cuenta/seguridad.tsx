import { Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { Separator } from "@renovabit/ui/components/ui/separator";
import { Spinner } from "@renovabit/ui/components/ui/spinner";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/shared/lib/auth/auth-client";
import { getAuthMessage } from "@/shared/lib/auth/auth-error-messages";
import { resetAuthState } from "@/shared/lib/auth/auth-session";
import { getFieldErrorId, normalizeFieldErrors } from "@/shared/lib/form/form-utils";

// ── Route ─────────────────────────────────────────

export const Route = createFileRoute("/_main/mi-cuenta/seguridad")({
	component: SeguridadPage,
});

// ── Password schema ────────────────────────────────

const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "La contraseña actual es obligatoria."),
		newPassword: z
			.string()
			.min(8, "Debe tener al menos 8 caracteres.")
			.max(128, "No puede superar 128 caracteres."),
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Las contraseñas no coinciden.",
		path: ["confirmPassword"],
	});

type PasswordFormValues = z.infer<typeof changePasswordSchema>;

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
	year: "numeric",
	month: "short",
	day: "numeric",
};

// ── Page component ─────────────────────────────────

function SeguridadPage() {
	const [sessionsKey, setSessionsKey] = useState(0);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Seguridad</h1>
				<p className="text-muted-foreground text-sm mt-1">
					Administra tu contraseña y sesiones activas.
				</p>
			</div>

			<ChangePasswordCard onPasswordChanged={() => setSessionsKey((k) => k + 1)} />
			<ActiveSessionsCard sessionsKey={sessionsKey} />
		</div>
	);
}

// ── Change Password Card ───────────────────────────

function ChangePasswordCard({ onPasswordChanged }: { onPasswordChanged: () => void }) {
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		} satisfies PasswordFormValues,
		validators: {
			onChange: changePasswordSchema,
			onSubmitAsync: async ({ value }) => {
				setServerError(null);

				const result = await authClient.changePassword({
					currentPassword: value.currentPassword,
					newPassword: value.newPassword,
					revokeOtherSessions: true,
				});

				if (result.error) {
					setServerError(getAuthMessage(result.error));
					return getAuthMessage(result.error);
				}
			},
		},
		onSubmit: () => {
			toast.success("Contraseña actualizada");
			form.reset();
			setServerError(null);
			onPasswordChanged();
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			noValidate
		>
			<Card>
				<CardHeader>
					<CardTitle>Cambiar contraseña</CardTitle>
					<CardDescription>
						Actualiza tu contraseña regularmente para mantener tu cuenta segura.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<FieldGroup>
						<form.Field name="currentPassword">
							{(field) => {
								const wasSubmitted = field.form.state.submissionAttempts > 0;
								const isInvalid =
									!!serverError ||
									((field.state.meta.isTouched || wasSubmitted) &&
										field.state.meta.errors.length > 0);
								const errorMessageId = getFieldErrorId("password-form", field.name);

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Contraseña actual</FieldLabel>
										<PasswordInput
											id={field.name}
											name={field.name}
											autoComplete="current-password"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
												field.handleChange(e.target.value);
												if (serverError) setServerError(null);
											}}
											aria-invalid={isInvalid}
											aria-describedby={isInvalid ? errorMessageId : undefined}
										/>
										{serverError && (
											<FieldError id={errorMessageId} errors={[{ message: serverError }]} />
										)}
										{!serverError && isInvalid && (
											<FieldError
												id={errorMessageId}
												errors={normalizeFieldErrors(field.state.meta.errors)}
											/>
										)}
									</Field>
								);
							}}
						</form.Field>

						<form.Field name="newPassword">
							{(field) => {
								const wasSubmitted = field.form.state.submissionAttempts > 0;
								const isInvalid =
									(field.state.meta.isTouched || wasSubmitted) &&
									field.state.meta.errors.length > 0;
								const errorMessageId = getFieldErrorId("password-form", field.name);

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Nueva contraseña</FieldLabel>
										<PasswordInput
											id={field.name}
											name={field.name}
											autoComplete="new-password"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
												field.handleChange(e.target.value)
											}
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

						<form.Field name="confirmPassword">
							{(field) => {
								const wasSubmitted = field.form.state.submissionAttempts > 0;
								const isInvalid =
									(field.state.meta.isTouched || wasSubmitted) &&
									field.state.meta.errors.length > 0;
								const errorMessageId = getFieldErrorId("password-form", field.name);

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Confirmar contraseña</FieldLabel>
										<PasswordInput
											id={field.name}
											name={field.name}
											autoComplete="new-password"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
												field.handleChange(e.target.value)
											}
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
					</FieldGroup>

					<form.Subscribe selector={(state) => state.isSubmitting}>
						{(isSubmitting) => (
							<Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
								{isSubmitting ? (
									<>
										<Spinner data-icon="inline-start" aria-hidden />
										<span>Cambiando...</span>
									</>
								) : (
									"Cambiar contraseña"
								)}
							</Button>
						)}
					</form.Subscribe>
				</CardContent>
			</Card>
		</form>
	);
}

// ── Session Types ──────────────────────────────────

interface SessionInfo {
	id: string;
	token: string;
	userId: string;
	ipAddress?: string | null;
	userAgent?: string | null;
	createdAt?: Date;
	expiresAt?: Date;
	isCurrent?: boolean;
}

interface AccountInfo {
	id: string;
	providerId: string;
}

// ── Active Sessions Card ──────────────────────────

function ActiveSessionsCard({ sessionsKey }: { sessionsKey: number }) {
	const [sessions, setSessions] = useState<SessionInfo[]>([]);
	const [accounts, setAccounts] = useState<AccountInfo[]>([]);
	const [isLoadingSessions, setIsLoadingSessions] = useState(true);
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const [isRevokingAll, setIsRevokingAll] = useState(false);
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const loadSessions = useCallback(async () => {
		setIsLoadingSessions(true);
		try {
			const [sessionsRes, currentRes] = await Promise.all([
				authClient.listSessions(),
				authClient.getSession({ query: { disableCookieCache: true } }),
			]);

			if (sessionsRes.error) {
				toast.error(getAuthMessage(sessionsRes.error));
				return;
			}

			const currentToken = currentRes.data?.session?.token;
			const sessionsData = (sessionsRes.data ?? []).map((s) => ({
				...s,
				isCurrent: s.token === currentToken,
			}));

			setSessions(sessionsData);
		} catch {
			toast.error("Error al cargar las sesiones activas.");
		} finally {
			setIsLoadingSessions(false);
		}
	}, []);

	const loadAccounts = useCallback(async () => {
		try {
			const { data: accountsData } = await authClient.listAccounts();
			setAccounts(accountsData ?? []);
		} catch {
			// Non-critical, silent fail
		}
	}, []);

	useEffect(() => {
		void loadSessions();
		void loadAccounts();
	}, [loadSessions, loadAccounts]);

	const handleRevoke = useCallback(
		async (sessionToken: string) => {
			if (!sessionToken) return;
			setRevokingId(sessionToken);

			const isCurrent = sessions.find((s) => s.token === sessionToken)?.isCurrent ?? false;
			const result = await authClient.revokeSession({ token: sessionToken });

			// ── Self-revoke: always sign out + redirect ──
			if (isCurrent) {
				if (result.error) {
					toast.error("No se pudo revocar la sesión. Cerrando sesión localmente...");
				} else {
					toast.success("Sesión cerrada");
				}
				// signOut bloqueante → cookies limpias → SPA navigation segura
				await authClient.signOut().catch(() => {
					// signOut es best-effort tras revoke — ignorar fallos
				});
				resetAuthState(queryClient);
				navigate({ to: "/iniciar-sesion", replace: true });
				return;
			}

			// ── Revocar otra sesión ──
			if (result.error) {
				toast.error(getAuthMessage(result.error));
			} else {
				toast.success("Sesión cerrada");
				await loadSessions();
			}
			setRevokingId(null);
		},
		[sessions, loadSessions, queryClient, navigate],
	);

	const handleRevokeOthers = useCallback(async () => {
		setIsRevokingAll(true);
		const result = await authClient.revokeOtherSessions();
		if (result.error) {
			toast.error(getAuthMessage(result.error));
		} else {
			toast.success("Sesiones cerradas");
			await loadSessions();
		}
		setIsRevokingAll(false);
	}, [loadSessions]);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Sesiones activas</CardTitle>
				<CardDescription>Dispositivos y ubicaciones donde has iniciado sesión.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Sessions list */}
				{isLoadingSessions ? (
					<div className="flex items-center justify-center py-8">
						<Spinner aria-hidden />
					</div>
				) : sessions.length === 0 ? (
					<p className="text-muted-foreground text-sm py-4 text-center">No hay sesiones activas</p>
				) : (
					<div className="divide-y">
						{sessions.map((session) => {
							const deviceInfo = parseUserAgent(session.userAgent ?? "");
							return (
								<div
									key={session.id}
									className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
								>
									<div className="min-w-0 flex-1 space-y-1">
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium truncate">
												{deviceInfo || "Dispositivo desconocido"}
											</span>
											{session.isCurrent && (
												<span className="text-primary text-xs font-bold shrink-0">
													Sesión actual
												</span>
											)}
										</div>
										<div className="text-muted-foreground text-xs space-x-2">
											{session.ipAddress && <span>IP: {session.ipAddress}</span>}
											{session.createdAt && (
												<span>
													Desde:{" "}
													{new Date(session.createdAt).toLocaleDateString("es-PE", DATE_FORMAT)}
												</span>
											)}
											{session.expiresAt && (
												<span>
													Expira:{" "}
													{new Date(session.expiresAt).toLocaleDateString("es-PE", DATE_FORMAT)}
												</span>
											)}
										</div>
									</div>

									{session.token ? (
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={revokingId === session.token || isRevokingAll}
											aria-busy={revokingId === session.token}
											onClick={() => handleRevoke(session.token)}
										>
											{revokingId === session.token ? (
												<Spinner aria-hidden className="size-3.5" />
											) : (
												"Revocar"
											)}
										</Button>
									) : null}
								</div>
							);
						})}
					</div>
				)}

				{/* Revoke all others */}
				{sessions.length > 1 && (
					<>
						<Separator />
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={isRevokingAll}
							aria-busy={isRevokingAll}
							onClick={handleRevokeOthers}
							className="w-full"
						>
							{isRevokingAll ? (
								<>
									<Spinner data-icon="inline-start" aria-hidden />
									<span>Cerrando sesiones...</span>
								</>
							) : (
								<>
									<HugeiconsIcon icon={Logout01Icon} className="size-4" />
									<span>Cerrar todas las demás sesiones</span>
								</>
							)}
						</Button>
					</>
				)}

				{/* Linked accounts */}
				{accounts.length > 0 && (
					<>
						<Separator />
						<div className="space-y-2">
							<h3 className="text-sm font-medium">Cuentas vinculadas</h3>
							{accounts.map((account) => (
								<div key={account.id} className="flex items-center gap-2 text-sm">
									<span className="text-muted-foreground text-sm">
										{providerLabel(account.providerId)}
									</span>
								</div>
							))}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

// ── Helpers ────────────────────────────────────────

/** Map Better Auth provider IDs to Spanish display names. */
function providerLabel(providerId: string): string {
	const map: Record<string, string> = {
		credential: "Correo y contraseña",
		google: "Google",
	};
	return map[providerId] ?? providerId;
}

function parseUserAgent(ua: string): string {
	if (!ua) return "";

	// Simplified UA parsing — extracts browser + OS
	const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/\d+/);
	const osMatch = ua.match(/\(([^)]+)\)/);

	const browser = browserMatch?.[1] ?? "";
	const os = osMatch?.[1]?.split(";")[0]?.trim() ?? "";

	return [browser, os].filter(Boolean).join(" / ") || "Desconocido";
}
