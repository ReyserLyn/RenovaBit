import {
	CheckmarkCircle02Icon,
	Copy01Icon,
	InformationCircleIcon,
	ShoppingBag01Icon,
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
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { WhatsAppIcon } from "@/shared/components/icons";
import { copyText } from "@/shared/lib/clipboard";
import { buildWhatsAppUrl, orderWhatsAppMessage } from "@/shared/lib/contact";
import { getSiteUrl } from "@/shared/lib/env";
import { formatPrice } from "@/shared/lib/format";

export interface OrderSuccessInfo {
	id: string;
	orderNumber: string;
	total: string;
	customerName?: string | null;
}

interface OrderSuccessPanelProps {
	order: OrderSuccessInfo;
	isLoggedIn: boolean;
}

export function OrderSuccessPanel({ order, isLoggedIn }: OrderSuccessPanelProps) {
	const [copied, setCopied] = useState<"order" | "link" | null>(null);
	const orderLink = isLoggedIn ? `${getSiteUrl()}/mis-pedidos/${order.id}` : null;
	const waUrl = buildWhatsAppUrl({
		message: orderWhatsAppMessage({
			orderNumber: order.orderNumber,
			total: formatPrice(order.total),
			customerName: order.customerName,
		}),
	});

	function handleCopy(kind: "order" | "link") {
		if (kind === "link" && !orderLink) return;
		const text = kind === "order" ? order.orderNumber : (orderLink ?? "");
		const label = kind === "order" ? "Número de pedido" : "Enlace del pedido";
		copyText(text, {
			label,
			onSuccess: () => {
				setCopied(kind);
				setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1500);
			},
		});
	}

	return (
		<div className="flex flex-1 flex-col items-center gap-6 py-8 sm:py-12">
			{/* ── Hero ─────────────────────────────── */}
			<div className="flex flex-col items-center gap-3 text-center">
				<div className="bg-success/10 text-success flex size-14 items-center justify-center rounded-full">
					<HugeiconsIcon icon={CheckmarkCircle02Icon} size={28} strokeWidth={1.5} />
				</div>
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">¡Pedido recibido!</h1>
					<p className="text-muted-foreground text-sm sm:text-base">
						Te contactaremos pronto para coordinar el pago y envío.
					</p>
				</div>
			</div>

			{/* ── Card con número de pedido ────────── */}
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardDescription>Tu número de pedido</CardDescription>
					<CardTitle className="text-2xl font-bold tracking-tight">{order.orderNumber}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-baseline justify-between border-t pt-3 text-sm">
						<span className="text-muted-foreground">Total</span>
						<span className="text-lg font-semibold tabular-nums">{formatPrice(order.total)}</span>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Button
							variant="outline"
							size="sm"
							className="flex-1"
							onClick={() => handleCopy("order")}
							aria-label="Copiar número de pedido"
						>
							<HugeiconsIcon
								icon={Copy01Icon}
								size={16}
								className={copied === "order" ? "text-success" : ""}
							/>
							{copied === "order" ? "Copiado" : "Copiar número"}
						</Button>
						{isLoggedIn && (
							<Button
								variant="outline"
								size="sm"
								className="flex-1"
								onClick={() => handleCopy("link")}
								aria-label="Copiar enlace del pedido"
							>
								<HugeiconsIcon
									icon={Copy01Icon}
									size={16}
									className={copied === "link" ? "text-success" : ""}
								/>
								{copied === "link" ? "Copiado" : "Copiar enlace"}
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			{/* ── Alert: contexto según logueado/guest ──── */}
			{isLoggedIn ? (
				<Alert appearance="light" variant="info" size="md" className="w-full max-w-md">
					<AlertIcon>
						<HugeiconsIcon icon={InformationCircleIcon} size={18} strokeWidth={1.5} />
					</AlertIcon>
					<AlertContent>
						<AlertTitle>Puedes revisar este pedido cuando quieras</AlertTitle>
						<AlertDescription>
							En el enlace copiado o en la sección{" "}
							<Link
								to="/mis-pedidos"
								className="font-medium underline underline-offset-2 hover:text-foreground"
							>
								Mis pedidos
							</Link>{" "}
							encontrarás el detalle, los productos y el estado actualizado.
						</AlertDescription>
					</AlertContent>
				</Alert>
			) : (
				<Alert appearance="light" variant="warning" size="md" className="w-full max-w-md">
					<AlertIcon>
						<HugeiconsIcon icon={InformationCircleIcon} size={18} strokeWidth={1.5} />
					</AlertIcon>
					<AlertContent>
						<AlertTitle>Guarda tu número de pedido</AlertTitle>
						<AlertDescription>
							Como todavía no inicias sesión, te recomendamos copiar tu número de pedido para
							consultarlo fácilmente por WhatsApp.{" "}
							<Link
								to="/iniciar-sesion"
								className="font-medium underline underline-offset-2 hover:text-foreground"
							>
								Inicia sesión
							</Link>{" "}
							para guardar tus datos, ver tus pedidos y acceder a beneficios.
						</AlertDescription>
					</AlertContent>
				</Alert>
			)}

			{/* ── CTAs ────────────────────────────── */}
			<div className="flex w-full max-w-md flex-col gap-2">
				<Button
					size="xl"
					className="w-full border-[#25D366] bg-[#25D366] text-white hover:bg-[#25D366]/90 hover:text-white"
					nativeButton={false}
					render={
						<a href={waUrl} target="_blank" rel="noopener noreferrer">
							<WhatsAppIcon className="size-5" />
							Contactar por WhatsApp
						</a>
					}
				/>
				<div className={`grid gap-2 ${isLoggedIn ? "grid-cols-2" : "grid-cols-1"}`}>
					{isLoggedIn && (
						<Button
							variant="outline"
							size="lg"
							nativeButton={false}
							render={<Link to="/mis-pedidos/$id" params={{ id: order.id }} />}
						>
							<HugeiconsIcon icon={ShoppingBag01Icon} size={18} />
							Ver pedido
						</Button>
					)}
					<Button
						variant={isLoggedIn ? "outline" : "default"}
						size="lg"
						nativeButton={false}
						render={<Link to="/" />}
					>
						Seguir comprando
					</Button>
				</div>
			</div>
		</div>
	);
}
