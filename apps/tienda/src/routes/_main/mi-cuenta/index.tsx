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
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import { Spinner } from "@renovabit/ui/components/ui/spinner";
import { useForm } from "@tanstack/react-form";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AvatarUpload } from "@/shared/components/profile/avatar-upload";
import type { Session } from "@/shared/lib/auth/auth-client";
import {
	authKeys,
	authSessionQueryOptions,
	profileKeys,
	profileQueryOptions,
} from "@/shared/lib/auth/auth-session";
import { getApiBaseUrl } from "@/shared/lib/env";
import { getFieldErrorId, normalizeFieldErrors } from "@/shared/lib/form/form-utils";

const apiBaseUrl = getApiBaseUrl();

export const Route = createFileRoute("/_main/mi-cuenta/")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.fetchQuery(authSessionQueryOptions());
		await queryClient.fetchQuery(profileQueryOptions());
	},
	component: MiCuentaIndexPage,
});

const profileSchema = z.object({
	name: z.string().trim().min(1, "El nombre es obligatorio."),
	lastname: z.string().trim().or(z.literal("")),
	displayUsername: z.string().trim().max(100).or(z.literal("")),
	phone: z.string().trim().max(20).or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function MiCuentaIndexPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
				<p className="text-muted-foreground text-sm mt-1">
					Administra tu información personal y foto de perfil.
				</p>
			</div>
			<Suspense fallback={<ProfileSkeleton />}>
				<ProfileForm />
			</Suspense>
		</div>
	);
}

function ProfileSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-32" />
				<Skeleton className="h-4 w-48" />
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-4">
					<Skeleton className="size-16 rounded-full" />
					<Skeleton className="h-8 w-28" />
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{[...Array(4)].map((_, i) => (
						<Skeleton key={i} className="h-8 w-full" />
					))}
				</div>
				<Skeleton className="h-8 w-32" />
			</CardContent>
		</Card>
	);
}

function ProfileForm() {
	const queryClient = useQueryClient();
	const { data: session } = useSuspenseQuery(authSessionQueryOptions());
	const user = session?.user;

	// Fresh DB profile — authoritative source, bypasses Better Auth's stale session cache
	const { data: freshProfile } = useSuspenseQuery(profileQueryOptions());

	const avatarUrl = freshProfile?.image ?? user?.image ?? null;

	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [removeAvatar, setRemoveAvatar] = useState(false);
	const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
	const [avatarResetKey, setAvatarResetKey] = useState(0);

	// Refs to avoid stale closure in useForm's onSubmitAsync
	const avatarFileRef = useRef(avatarFile);
	avatarFileRef.current = avatarFile;
	const removeAvatarRef = useRef(removeAvatar);
	removeAvatarRef.current = removeAvatar;

	// Initial values for change detection — use fresh DB profile as source of truth
	const initial = useRef({
		name: freshProfile?.name ?? "",
		lastname: freshProfile?.lastname ?? "",
		displayUsername: freshProfile?.displayUsername ?? "",
		phone: freshProfile?.phone ?? "",
		image: freshProfile?.image ?? null,
	});

	const form = useForm({
		defaultValues: {
			name: freshProfile?.name ?? "",
			lastname: freshProfile?.lastname ?? "",
			displayUsername: freshProfile?.displayUsername ?? "",
			phone: freshProfile?.phone ?? "",
		} satisfies ProfileFormValues,
		validators: {
			onChange: profileSchema,
			onSubmitAsync: async ({ value }) => {
				setServerFieldErrors({});

				const formData = new FormData();
				formData.append("name", value.name);
				appendOrEmpty(formData, "lastname", value.lastname);
				appendOrEmpty(formData, "displayUsername", value.displayUsername);
				appendOrEmpty(formData, "phone", value.phone);

				const file = avatarFileRef.current;
				const shouldRemove = removeAvatarRef.current;

				if (file) {
					formData.append("image", file);
				} else if (shouldRemove) {
					formData.append("removeImage", "true");
				}

				const response = await fetch(`${apiBaseUrl}/api/v1/users/me`, {
					method: "PATCH",
					credentials: "include",
					body: formData,
				});

				if (!response.ok) {
					const body = await response.json().catch(() => null);
					const message: string = body?.message ?? "Error al actualizar el perfil.";
					const field: string | undefined = body?.metadata?.field;

					// Map API field-level errors (avoids fragile string matching)
					if (field) {
						setServerFieldErrors({ [field]: message });
					} else {
						toast.error(message);
					}
					return message;
				}

				const updatedUser = await response.json();

				// Update session cache so navbar reflects changes immediately
				queryClient.setQueryData<Session>(authKeys.session(), (oldData) => {
					if (!oldData) return oldData;
					return {
						...oldData,
						user: {
							...oldData.user,
							name: updatedUser.name,
							image: updatedUser.image,
							lastname: updatedUser.lastname,
							displayUsername: updatedUser.displayUsername,
							phone: updatedUser.phone,
						},
					};
				});
				queryClient.setQueryData(profileKeys.all, updatedUser);

				setAvatarFile(null);
				setRemoveAvatar(false);
				setAvatarResetKey((k) => k + 1);
				toast.success("Perfil actualizado");
			},
		},
	});

	const handleAvatarFileChange = useCallback((file: File | null) => {
		setAvatarFile(file);
		setRemoveAvatar(false);
	}, []);

	const handleAvatarRemove = useCallback(() => {
		setAvatarFile(null);
		setRemoveAvatar(true);
	}, []);

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
					<CardTitle>Información personal</CardTitle>
					<CardDescription>
						Tu nombre, foto y datos de contacto visibles en la tienda.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					<AvatarUpload
						key={avatarResetKey}
						currentImage={removeAvatar ? null : avatarUrl}
						userName={user?.name ?? ""}
						onFileChange={handleAvatarFileChange}
						onRemove={handleAvatarRemove}
					/>

					<FieldGroup>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<form.Field name="name">
								{(field) => {
									const wasSubmitted = field.form.state.submissionAttempts > 0;
									const isInvalid =
										(field.state.meta.isTouched || wasSubmitted) &&
										field.state.meta.errors.length > 0;
									const errorMessageId = getFieldErrorId("profile-form", field.name);
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
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
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

							<form.Field name="lastname">
								{(field) => {
									const wasSubmitted = field.form.state.submissionAttempts > 0;
									const isInvalid =
										(field.state.meta.isTouched || wasSubmitted) &&
										field.state.meta.errors.length > 0;
									const errorMessageId = getFieldErrorId("profile-form", field.name);
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Apellido</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
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

							<form.Field name="displayUsername">
								{(field) => {
									const wasSubmitted = field.form.state.submissionAttempts > 0;
									const serverError = serverFieldErrors[field.name];
									const isInvalid =
										!!serverError ||
										((field.state.meta.isTouched || wasSubmitted) &&
											field.state.meta.errors.length > 0);
									const errorMessageId = getFieldErrorId("profile-form", field.name);
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Nombre de Usuario</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => {
													field.handleChange(e.target.value);
													if (serverError) {
														setServerFieldErrors((prev) => {
															const next = { ...prev };
															delete next[field.name];
															return next;
														});
													}
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

							<form.Field name="phone">
								{(field) => {
									const wasSubmitted = field.form.state.submissionAttempts > 0;
									const isInvalid =
										(field.state.meta.isTouched || wasSubmitted) &&
										field.state.meta.errors.length > 0;
									const errorMessageId = getFieldErrorId("profile-form", field.name);
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Teléfono</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												type="tel"
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
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

							<Field>
								<FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
								<Input
									id="email"
									name="email"
									type="email"
									value={user?.email ?? ""}
									disabled
									readOnly
									aria-readonly
								/>
							</Field>
						</div>
					</FieldGroup>
					<form.Subscribe
						selector={(state) => ({
							isSubmitting: state.isSubmitting,
							values: state.values,
						})}
					>
						{({ isSubmitting, values }) => {
							const textChanged =
								values.name !== initial.current.name ||
								values.lastname !== initial.current.lastname ||
								values.displayUsername !== initial.current.displayUsername ||
								values.phone !== initial.current.phone;
							const hasChanges = textChanged || avatarFile !== null || removeAvatar;

							return (
								<Button
									type="submit"
									disabled={isSubmitting || !hasChanges}
									aria-busy={isSubmitting}
								>
									{isSubmitting ? (
										<>
											<Spinner data-icon="inline-start" aria-hidden />
											<span>Guardando...</span>
										</>
									) : (
										"Guardar cambios"
									)}
								</Button>
							);
						}}
					</form.Subscribe>
				</CardContent>
			</Card>
		</form>
	);
}

function appendOrEmpty(formData: FormData, key: string, value: string) {
	if (value) {
		formData.append(key, value);
	} else {
		formData.append(key, "");
	}
}
