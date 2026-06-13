import {
	Cancel01Icon,
	ExternalLinkIcon,
	Mail01Icon,
	MoneyReceive01Icon,
	PhoneCheckIcon,
	ShoppingCartCheck02Icon,
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
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import { getSiteUrl } from "@/shared/lib/env";
import { getFieldErrorId, normalizeFieldErrors } from "@/shared/lib/form/form-utils";
import { useOrder, useUpdateOrderStatus } from "../hooks";
import { formatCurrency, formatFullDate } from "../lib/format";
import {
	ORDER_STATUS_CONFIG,
	type OrderStatus,
	PAYMENT_METHOD_LABELS,
	SOURCE_LABELS,
	STATUS_CHANGE_LABEL,
	updateOrderStatusSchema,
	VALID_STATUS_TRANSITIONS,
} from "../model";
import type { UpdateOrderStatusValues } from "../service/orders.service";

// ── Constants ────────────────────────────────────────────

function buildWhatsAppMessage(orderNumber: string): string {
	return `Hola, te escribo acerca de tu pedido *${orderNumber}* en RenovaBit. ¿Podemos coordinar el pago y la entrega?`;
}

// ── Props ───────────────────────────────────────────────

interface OrderDetailDialogProps {
	orderId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

// ── Component ───────────────────────────────────────────

export function OrderDetailDialog({ orderId, open, onOpenChange }: OrderDetailDialogProps) {
	const { data: order, isPending, isError, error } = useOrder(orderId ?? "");
	const updateStatus = useUpdateOrderStatus();

	const [confirmState, setConfirmState] = useState<{
		newStatus: OrderStatus;
	} | null>(null);

	const isStatusChanging = updateStatus.isPending;

	const handleStatusChangeConfirm = async () => {
		if (!confirmState || !orderId) return;
		try {
			await updateStatus.mutateAsync({
				id: orderId,
				data: { status: confirmState.newStatus },
			});
		} catch {
			// mutation onError already shows toast
		} finally {
			setConfirmState(null);
		}
	};

	const transitions = order ? (VALID_STATUS_TRANSITIONS[order.status] ?? []) : [];

	return (
		<>
			<Dialog
				open={open}
				onOpenChange={(next) => {
					if (!next && isStatusChanging) return;
					onOpenChange(next);
				}}
			>
				<DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[90dvh] flex flex-col overflow-hidden">
					{isPending ? (
						<div className="p-8 space-y-4">
							<Skeleton className="h-6 w-48" />
							<Skeleton className="h-4 w-64" />
							<Skeleton className="h-32 w-full" />
							<Skeleton className="h-32 w-full" />
						</div>
					) : isError || !order ? (
						<div className="p-8">
							<DialogHeader>
								<DialogTitle>Error</DialogTitle>
								<DialogDescription>
									{isError ? resolveErrorMessage(error) : "Pedido no encontrado"}
								</DialogDescription>
							</DialogHeader>
						</div>
					) : (
						<>
							{/* ── Header ── */}
							<DialogHeader className="shrink-0 p-6 pb-2">
								<div className="flex items-center gap-3 flex-wrap">
									<DialogTitle className="font-mono text-lg">{order.orderNumber}</DialogTitle>
									<Badge variant={ORDER_STATUS_CONFIG[order.status]?.variant ?? "secondary"}>
										{ORDER_STATUS_CONFIG[order.status]?.label ?? order.status}
									</Badge>
								</div>
								<DialogDescription>{formatFullDate(order.createdAt)}</DialogDescription>
							</DialogHeader>

							{/* ── Scrollable body ── */}
							<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-6">
								{/* ── Alerts ── */}
								{order.status === "pending" && (
									<div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
										<p className="text-warning-foreground text-sm">
											Este pedido se cancelará automáticamente si no se confirma en 2 días.
										</p>
									</div>
								)}
								{order.status === "cancelled" && order.cancelReason && (
									<div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
										<p className="text-destructive-subtle-foreground text-sm font-medium">
											Motivo de cancelación:
										</p>
										<p className="text-destructive-subtle-foreground text-sm">
											{order.cancelReason}
										</p>
									</div>
								)}

								{/* ── Customer ── */}
								<div className="rounded-lg border p-4">
									<h3 className="font-medium text-sm mb-3">Cliente</h3>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div className="flex items-center gap-2 text-sm">
											<HugeiconsIcon
												icon={UserCheck01Icon}
												className="size-4 text-muted-foreground shrink-0"
											/>
											<span>{order.customerName || "—"}</span>
										</div>
										{order.customerPhone ? (
											<div className="flex items-center gap-2 text-sm">
												<HugeiconsIcon
													icon={PhoneCheckIcon}
													className="size-4 text-muted-foreground shrink-0"
												/>
												<span>{order.customerPhone}</span>
											</div>
										) : order.customerEmail ? (
											<div className="flex items-center gap-2 text-sm">
												<HugeiconsIcon
													icon={Mail01Icon}
													className="size-4 text-muted-foreground shrink-0"
												/>
												<span>{order.customerEmail}</span>
											</div>
										) : null}
									</div>
								</div>

								{/* ── Order info ── */}
								<div className="rounded-lg border p-4">
									<h3 className="font-medium text-sm mb-3">Información del pedido</h3>
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
										<div className="flex flex-col gap-1">
											<span className="text-muted-foreground text-xs">Pago</span>
											<span className="text-sm">
												{order.paymentMethod
													? (PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod)
													: "—"}
											</span>
										</div>
										<div className="flex flex-col gap-1">
											<span className="text-muted-foreground text-xs">Origen</span>
											<span className="text-sm">{SOURCE_LABELS[order.source] ?? order.source}</span>
										</div>
										{order.confirmedAt && (
											<div className="flex flex-col gap-1">
												<span className="text-muted-foreground text-xs">Confirmado</span>
												<span className="text-sm">{formatFullDate(order.confirmedAt)}</span>
											</div>
										)}
										{order.cancelledAt && (
											<div className="flex flex-col gap-1">
												<span className="text-muted-foreground text-xs">Cancelado</span>
												<span className="text-sm">{formatFullDate(order.cancelledAt)}</span>
											</div>
										)}
									</div>
								</div>

								{/* ── Products ── */}
								<div className="rounded-lg border">
									<div className="p-4 pb-2">
										<h3 className="font-medium text-sm">Productos ({order.items.length})</h3>
									</div>
									<div className="overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-t bg-muted/50">
													<th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">
														Producto
													</th>
													<th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">
														SKU
													</th>
													<th className="px-4 py-2 text-center font-medium text-muted-foreground text-xs">
														Cant.
													</th>
													<th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs">
														P. Unit.
													</th>
													<th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs">
														Final
													</th>
													<th className="px-4 py-2 w-10" />
												</tr>
											</thead>
											<tbody className="divide-y">
												{order.items.map((item) => (
													<tr key={item.id}>
														<td className="px-4 py-2.5">{item.productName}</td>
														<td className="px-4 py-2.5 font-mono text-muted-foreground text-xs">
															{item.productSku}
														</td>
														<td className="px-4 py-2.5 text-center tabular-nums">
															{item.quantity}
														</td>
														<td className="px-4 py-2.5 text-right tabular-nums">
															{formatCurrency(item.unitPrice)}
														</td>
														<td className="px-4 py-2.5 text-right tabular-nums font-medium">
															{formatCurrency(item.finalPrice)}
														</td>
														<td className="px-2 py-2.5">
															<a
																href={`${getSiteUrl()}/buscar?q=${encodeURIComponent(item.productSku)}`}
																target="_blank"
																rel="noopener noreferrer"
																aria-label={`Ver ${item.productName} en la tienda`}
																className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
															>
																<HugeiconsIcon icon={ExternalLinkIcon} className="size-3.5" />
															</a>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>

								{/* ── Financial summary ── */}
								<div className="rounded-lg border p-4">
									<h3 className="font-medium text-sm mb-3">Resumen</h3>
									<div className="space-y-2">
										<div className="flex justify-between text-sm">
											<span className="text-muted-foreground">Subtotal</span>
											<span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
										</div>
										{Number.parseFloat(order.discountTotal) > 0 && (
											<div className="flex justify-between text-sm">
												<span className="text-muted-foreground">Descuento</span>
												<span className="tabular-nums text-success">
													-{formatCurrency(order.discountTotal)}
												</span>
											</div>
										)}
										<Separator />
										<div className="flex justify-between font-semibold text-sm">
											<span>Total</span>
											<span className="tabular-nums">{formatCurrency(order.total)}</span>
										</div>
									</div>
								</div>

								{/* ── Admin Notes ── */}
								<AdminNotesForm
									key={orderId}
									orderId={orderId}
									order={order}
									updateStatus={updateStatus}
								/>

								{/* ── Customer notes ── */}

								{/* ── Customer notes ── */}
								{order.notes && (
									<div className="rounded-lg border p-4">
										<h3 className="font-medium text-sm mb-2">Nota del cliente</h3>
										<p className="text-sm whitespace-pre-wrap text-muted-foreground">
											{order.notes}
										</p>
									</div>
								)}
							</div>

							{/* ── Footer with actions ── */}
							<DialogFooter
								className="shrink-0 px-6 pb-6 pt-2 border-t"
								showCloseButton
								closeLabel="Cerrar"
							>
								<div className="flex items-center gap-2">
									{order.customerPhone && (
										<Button
											variant="outline"
											size="default"
											className="[&_svg]:text-green-600 [&_svg]:dark:text-green-400"
											render={
												<a
													href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(buildWhatsAppMessage(order.orderNumber))}`}
													target="_blank"
													rel="noopener noreferrer"
												>
													<HugeiconsIcon icon={WhatsappIcon} className="size-4" />
													WhatsApp
												</a>
											}
										/>
									)}
									{transitions.includes("confirmed") && (
										<Button
											variant="default"
											onClick={() => setConfirmState({ newStatus: "confirmed" })}
											disabled={isStatusChanging}
										>
											<HugeiconsIcon icon={ShoppingCartCheck02Icon} className="size-4" />
											Confirmar pedido
										</Button>
									)}
									{transitions.includes("cancelled") && (
										<Button
											variant="destructive"
											onClick={() => setConfirmState({ newStatus: "cancelled" })}
											disabled={isStatusChanging}
										>
											<HugeiconsIcon icon={Cancel01Icon} className="size-4" />
											Cancelar pedido
										</Button>
									)}
									{transitions.includes("refunded") && (
										<Button
											variant="outline"
											onClick={() => setConfirmState({ newStatus: "refunded" })}
											disabled={isStatusChanging}
										>
											<HugeiconsIcon icon={MoneyReceive01Icon} className="size-4" />
											Reembolsar
										</Button>
									)}
								</div>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>

			{confirmState && order ? (
				<ConfirmDialog
					isOpen
					onClose={() => {
						if (!isStatusChanging) setConfirmState(null);
					}}
					onConfirm={handleStatusChangeConfirm}
					title={STATUS_CHANGE_LABEL[confirmState.newStatus] ?? "Cambiar estado"}
					description={`¿Estás seguro de que deseas cambiar el pedido ${order.orderNumber} a "${ORDER_STATUS_CONFIG[confirmState.newStatus]?.label ?? confirmState.newStatus}"?`}
					confirmText={STATUS_CHANGE_LABEL[confirmState.newStatus] ?? "Confirmar"}
					isLoading={isStatusChanging}
					variant={confirmState.newStatus === "cancelled" ? "destructive" : "default"}
				/>
			) : null}
		</>
	);
}

// ── Sub-components ────────────────────────────────────

const ADMIN_NOTES_FORM_ID = "admin-notes-form";

function AdminNotesForm({
	orderId,
	order,
	updateStatus,
}: {
	orderId: string | null;
	order: { adminNotes?: string | null; status: string };
	updateStatus: {
		isPending: boolean;
		mutateAsync: (data: { id: string; data: UpdateOrderStatusValues }) => Promise<unknown>;
	};
}) {
	const form = useForm({
		defaultValues: { adminNotes: order?.adminNotes ?? "" },
		onSubmit: async ({ value }) => {
			if (!orderId || !order) return;
			const parsed = updateOrderStatusSchema.shape.status.safeParse(order.status);
			if (!parsed.success) return;
			await updateStatus.mutateAsync({
				id: orderId,
				data: { status: parsed.data, adminNotes: value.adminNotes },
			});
		},
	});

	return (
		<div className="rounded-lg border p-4">
			<h3 className="font-medium text-sm mb-3">Notas del admin</h3>
			<form
				id={ADMIN_NOTES_FORM_ID}
				className="flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				noValidate
			>
				<FieldGroup>
					<form.Field name="adminNotes">
						{(field) => {
							const errorMessageId = getFieldErrorId(ADMIN_NOTES_FORM_ID, field.name);
							const isInvalid = field.state.meta.errors.length > 0;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name} className="sr-only">
										Notas del admin
									</FieldLabel>
									<Textarea
										id={field.name}
										name={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										placeholder="Notas internas sobre este pedido…"
										rows={3}
										disabled={updateStatus.isPending}
										aria-invalid={isInvalid}
										aria-describedby={isInvalid ? errorMessageId : undefined}
										maxLength={2000}
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
					<Button type="submit" variant="outline" size="sm" disabled={updateStatus.isPending}>
						{updateStatus.isPending ? "Guardando…" : "Guardar notas"}
					</Button>
				</div>
			</form>
		</div>
	);
}
