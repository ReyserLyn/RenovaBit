import {
	Calendar01Icon,
	IdCardIcon,
	Location01Icon,
	Mail01Icon,
	Message02Icon,
	PhoneCheckIcon,
	SentIcon,
	UserCheck01Icon,
	WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
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
import { Separator } from "@renovabit/ui/components/ui/separator";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import { Textarea } from "@renovabit/ui/components/ui/textarea";
import { cn } from "@renovabit/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import type { ReactNode } from "react";
import { useState } from "react";
import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import { getFieldErrorId, normalizeFieldErrors } from "@/shared/lib/form/form-utils";
import { useComplaint, useRespondToComplaint } from "../hooks";
import { formatFullDate } from "../lib/format";
import {
	COMPLAINT_STATUS_CONFIG,
	COMPLAINT_TYPE_LABELS,
	type ComplaintDetail,
	RESPONSE_TEXT_MAX,
	type RespondComplaintFormValues,
	respondComplaintSchema,
} from "../model";

// ── Constants ────────────────────────────────────────────

const RESPOND_FORM_ID = "respond-complaint-form";

function buildWhatsAppMessage(code: string): string {
	return `Hola, te escribimos de RenovaBit sobre tu hoja de reclamación *${code}*.`;
}

function toWhatsAppPhone(phone: string): string {
	return phone.replace(/\D/g, "");
}

// ── Props ───────────────────────────────────────────────

interface ComplaintDetailDialogProps {
	complaintId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

// ── Component ───────────────────────────────────────────

export function ComplaintDetailDialog({
	complaintId,
	open,
	onOpenChange,
}: ComplaintDetailDialogProps) {
	const { data: complaint, isPending, isError, error } = useComplaint(complaintId ?? "");

	const isResponded =
		complaint?.status === "responded" || (complaint?.respondedAt ?? null) !== null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[90dvh] flex flex-col overflow-hidden">
				{isPending ? (
					<div className="p-8 space-y-4">
						<Skeleton className="h-6 w-48" />
						<Skeleton className="h-4 w-64" />
						<Skeleton className="h-32 w-full" />
						<Skeleton className="h-32 w-full" />
					</div>
				) : isError || !complaint ? (
					<div className="p-8">
						<DialogHeader>
							<DialogTitle>Error</DialogTitle>
							<DialogDescription>
								{isError ? resolveErrorMessage(error) : "Reclamo no encontrado"}
							</DialogDescription>
						</DialogHeader>
					</div>
				) : (
					<>
						{/* ── Header ── */}
						<DialogHeader className="shrink-0 p-6 pb-2">
							<div className="flex items-center gap-3 flex-wrap">
								<DialogTitle className="font-mono text-lg">{complaint.code}</DialogTitle>
								<Badge variant={COMPLAINT_STATUS_CONFIG[complaint.status]?.variant ?? "secondary"}>
									{COMPLAINT_STATUS_CONFIG[complaint.status]?.label ?? complaint.status}
								</Badge>
								<Badge variant="outline">{COMPLAINT_TYPE_LABELS[complaint.type]}</Badge>
								{complaint.isMinor && <Badge variant="warning-light">Menor de edad</Badge>}
							</div>
							<DialogDescription>
								Registrado el {formatFullDate(complaint.createdAt)}
							</DialogDescription>
						</DialogHeader>

						{/* ── Scrollable body ── */}
						<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-6">
							{/* ── Complainant ── */}
							<div className="rounded-lg border p-4">
								<h3 className="font-medium text-sm mb-3">Reclamante</h3>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<InfoRow icon={<HugeiconsIcon icon={UserCheck01Icon} />}>
										{complaint.fullName}
									</InfoRow>
									<InfoRow icon={<HugeiconsIcon icon={IdCardIcon} />}>
										{complaint.docType} {complaint.docNumber}
									</InfoRow>
									<InfoRow icon={<HugeiconsIcon icon={Mail01Icon} />}>
										<a
											href={`mailto:${complaint.email}`}
											className="underline-offset-4 hover:underline"
										>
											{complaint.email}
										</a>
									</InfoRow>
									<InfoRow icon={<HugeiconsIcon icon={PhoneCheckIcon} />}>
										{complaint.phone}
									</InfoRow>
									<InfoRow icon={<HugeiconsIcon icon={Location01Icon} />} className="sm:col-span-2">
										{complaint.address}
									</InfoRow>
								</div>
							</div>

							{/* ── Minor ── */}
							{complaint.isMinor && (
								<div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
									<h3 className="font-medium text-sm mb-3">Padre, madre o apoderado</h3>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<InfoRow icon={<HugeiconsIcon icon={UserCheck01Icon} />}>
											{complaint.guardianName ?? "—"}
										</InfoRow>
										<InfoRow icon={<HugeiconsIcon icon={IdCardIcon} />}>
											{complaint.guardianDocNumber ?? "—"}
										</InfoRow>
									</div>
								</div>
							)}

							{/* ── Facts and request ── */}
							<div className="rounded-lg border p-4 space-y-4">
								<div>
									<h3 className="font-medium text-sm mb-2">Hechos</h3>
									<p className="text-sm whitespace-pre-wrap text-muted-foreground">
										{complaint.description}
									</p>
								</div>
								<Separator />
								<div>
									<h3 className="font-medium text-sm mb-2">Pedido concreto</h3>
									<p className="text-sm whitespace-pre-wrap text-muted-foreground">
										{complaint.request}
									</p>
								</div>
								{complaint.orderNumber && (
									<>
										<Separator />
										<div className="flex items-center gap-2 text-sm">
											<HugeiconsIcon
												icon={Message02Icon}
												className="size-4 text-muted-foreground shrink-0"
											/>
											<span className="text-muted-foreground">Pedido relacionado:</span>
											<span className="font-mono">{complaint.orderNumber}</span>
										</div>
									</>
								)}
							</div>

							{/* ── Response + respond form ── */}
							<RespondSection
								key={complaintId}
								complaintId={complaintId}
								complaint={complaint}
								isResponded={isResponded}
							/>

							{/* ── Dates ── */}
							<div className="rounded-lg border p-4">
								<h3 className="font-medium text-sm mb-3">Fechas</h3>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<InfoRow icon={<HugeiconsIcon icon={Calendar01Icon} />}>
										Registrado: {formatFullDate(complaint.createdAt)}
									</InfoRow>
									{complaint.respondedAt && (
										<InfoRow icon={<HugeiconsIcon icon={Calendar01Icon} />}>
											Respondido: {formatFullDate(complaint.respondedAt)}
										</InfoRow>
									)}
								</div>
							</div>
						</div>

						{/* ── Footer ── */}
						<DialogFooter
							className="shrink-0 px-6 pb-6 pt-2 border-t"
							showCloseButton
							closeLabel="Cerrar"
						>
							{toWhatsAppPhone(complaint.phone).length >= 6 && (
								<Button
									variant="outline"
									size="default"
									className="[&_svg]:text-green-600 [&_svg]:dark:text-green-400"
									render={
										<a
											href={`https://wa.me/${toWhatsAppPhone(complaint.phone)}?text=${encodeURIComponent(buildWhatsAppMessage(complaint.code))}`}
											target="_blank"
											rel="noopener noreferrer"
										>
											<HugeiconsIcon icon={WhatsappIcon} className="size-4" />
											WhatsApp
										</a>
									}
								/>
							)}
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

// ── Sub-components ────────────────────────────────────

function InfoRow({
	icon,
	children,
	className,
}: {
	icon: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex items-start gap-2 text-sm", className)}>
			<span className="[&_svg]:size-4 text-muted-foreground mt-0.5 shrink-0">{icon}</span>
			<span className="min-w-0 break-words">{children}</span>
		</div>
	);
}

function RespondSection({
	complaintId,
	complaint,
	isResponded,
}: {
	complaintId: string | null;
	complaint: ComplaintDetail;
	isResponded: boolean;
}) {
	const respond = useRespondToComplaint();
	const [confirmText, setConfirmText] = useState<string | null>(null);

	const form = useForm({
		defaultValues: { responseText: "" } as RespondComplaintFormValues,
		validators: {
			onChange: respondComplaintSchema,
		},
		onSubmit: async ({ value }) => {
			setConfirmText(value.responseText.trim());
		},
	});

	const handleConfirm = async () => {
		if (!complaintId || confirmText === null) return;
		try {
			await respond.mutateAsync({ id: complaintId, data: { responseText: confirmText } });
			form.reset();
		} catch {
			// mutation onError already shows the toast
		} finally {
			setConfirmText(null);
		}
	};

	return (
		<>
			<div className="rounded-lg border p-4">
				<h3 className="font-medium text-sm mb-3">Respuesta al reclamante</h3>

				{complaint.responseText && (
					<div className="rounded-md border border-success/20 bg-success/5 p-3 mb-4">
						<p className="text-sm whitespace-pre-wrap">{complaint.responseText}</p>
						{complaint.respondedAt && (
							<p className="text-muted-foreground text-xs mt-2">
								Respondido el {formatFullDate(complaint.respondedAt)}
							</p>
						)}
					</div>
				)}

				{isResponded ? (
					<p className="text-muted-foreground text-sm">
						Este reclamo ya fue respondido. No se puede enviar otra respuesta.
					</p>
				) : null}

				<form
					id={RESPOND_FORM_ID}
					className="flex flex-col gap-3"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						void form.handleSubmit();
					}}
					noValidate
				>
					<FieldGroup>
						<form.Field name="responseText">
							{(field) => {
								const wasSubmitted = field.form.state.submissionAttempts > 0;
								const isInvalid =
									(field.state.meta.isTouched || wasSubmitted) &&
									field.state.meta.errors.length > 0;
								const errorMessageId = getFieldErrorId(RESPOND_FORM_ID, field.name);

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={`${RESPOND_FORM_ID}-responseText`}>Respuesta</FieldLabel>
										<Textarea
											id={`${RESPOND_FORM_ID}-responseText`}
											name={field.name}
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											placeholder="Escribe la respuesta que quedará registrada en el libro de reclamaciones…"
											rows={4}
											maxLength={RESPONSE_TEXT_MAX}
											disabled={isResponded || respond.isPending}
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
					<div className="flex justify-end">
						<Button
							type="submit"
							disabled={isResponded || respond.isPending}
							className="[&_svg]:size-4"
						>
							<HugeiconsIcon icon={SentIcon} />
							{respond.isPending ? "Enviando…" : "Enviar respuesta"}
						</Button>
					</div>
				</form>
			</div>

			{confirmText !== null ? (
				<ConfirmDialog
					isOpen
					onClose={() => {
						if (!respond.isPending) setConfirmText(null);
					}}
					onConfirm={handleConfirm}
					title="Enviar respuesta"
					description='¿Confirmas enviar esta respuesta? El reclamo pasará al estado "Respondido" y la respuesta quedará registrada en el libro de reclamaciones.'
					confirmText="Enviar respuesta"
					isLoading={respond.isPending}
				/>
			) : null}
		</>
	);
}
