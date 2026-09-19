import {
	COMPLAINT_STATUS_TUPLE,
	type ComplaintDocType,
	type ComplaintStatus,
	type ComplaintType,
} from "@renovabit/db/schema";
import { z } from "zod";

// ── Constants ────────────────────────────────────────────

export const RESPONSE_TEXT_MIN = 10;
export const RESPONSE_TEXT_MAX = 5000;

export const COMPLAINT_TYPE_LABELS: Record<ComplaintType, string> = {
	reclamo: "Reclamo",
	queja: "Queja",
};

type ComplaintStatusConfig = Record<
	ComplaintStatus,
	{
		label: string;
		variant: "invert-light" | "info" | "success";
	}
>;

export const COMPLAINT_STATUS_CONFIG: ComplaintStatusConfig = {
	pending: { label: "Pendiente", variant: "invert-light" },
	in_review: { label: "En revisión", variant: "info" },
	responded: { label: "Respondido", variant: "success" },
};

export const COMPLAINT_STATUS_FILTER_OPTIONS = [
	{ label: "Todos los estados", value: "all" },
	{ label: COMPLAINT_STATUS_CONFIG.pending.label, value: "pending" },
	{ label: COMPLAINT_STATUS_CONFIG.in_review.label, value: "in_review" },
	{ label: COMPLAINT_STATUS_CONFIG.responded.label, value: "responded" },
] as const;

export function isComplaintStatus(value: string): value is ComplaintStatus {
	return (COMPLAINT_STATUS_TUPLE as readonly string[]).includes(value);
}

// ── Domain Types ────────────────────────────────────────

export type { ComplaintDocType, ComplaintStatus, ComplaintType };

export interface ComplaintListItem {
	id: string;
	code: string;
	type: ComplaintType;
	fullName: string;
	docType: ComplaintDocType;
	docNumber: string;
	email: string;
	phone: string;
	orderNumber: string | null;
	isMinor: boolean;
	status: ComplaintStatus;
	createdAt: string;
	respondedAt: string | null;
}

export interface ComplaintDetail extends ComplaintListItem {
	address: string;
	guardianName: string | null;
	guardianDocNumber: string | null;
	description: string;
	request: string;
	responseText: string | null;
	updatedAt: string;
}

export interface ComplaintListResponse {
	complaints: ComplaintListItem[];
	total: number;
}

// ── Zod Schemas ─────────────────────────────────────────

export const respondComplaintSchema = z.object({
	responseText: z
		.string()
		.trim()
		.min(RESPONSE_TEXT_MIN, {
			error: `La respuesta debe tener al menos ${RESPONSE_TEXT_MIN} caracteres`,
		})
		.max(RESPONSE_TEXT_MAX, {
			error: `La respuesta no puede superar ${RESPONSE_TEXT_MAX} caracteres`,
		}),
});

export type RespondComplaintFormValues = z.infer<typeof respondComplaintSchema>;
