import {
	Cancel01Icon,
	CloudUploadIcon,
	Image01Icon,
	Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, buttonVariants } from "@renovabit/ui/components/ui/button";
import { cn } from "@renovabit/ui/lib/utils";
import { useCallback, useRef, useState } from "react";
import { uploadImage, validateImageFile } from "@/shared/lib/storage/storage-service";
import { useUpdateOrderAttachments } from "../hooks";

const MAX_ATTACHMENTS = 10;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/avif";

interface OrderAttachmentsProps {
	orderId: string | null;
	attachments: string[];
}

export function OrderAttachments({ orderId, attachments }: OrderAttachmentsProps) {
	if (!orderId) return null;

	return <OrderAttachmentsContent orderId={orderId} attachments={attachments} />;
}

function OrderAttachmentsContent({
	orderId,
	attachments,
}: {
	orderId: string;
	attachments: string[];
}) {
	const updateAttachments = useUpdateOrderAttachments();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [uploadingCount, setUploadingCount] = useState(0);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [localAttachments, setLocalAttachments] = useState<string[]>(attachments);

	const isBusy = updateAttachments.isPending || uploadingCount > 0;
	const hasRoom = localAttachments.length < MAX_ATTACHMENTS;

	async function uploadFiles(files: File[]) {
		if (isBusy) return;

		const remaining = MAX_ATTACHMENTS - localAttachments.length;
		if (remaining <= 0) return;

		const toUpload = files.slice(0, remaining);

		const firstError = toUpload
			.map((f) => validateImageFile(f, MAX_FILE_BYTES))
			.find((err): err is string => err !== null);

		if (firstError) {
			setUploadError(firstError);
			return;
		}

		setUploadError(null);
		const uploadedUrls: string[] = [];

		for (const file of toUpload) {
			setUploadingCount((c) => c + 1);
			try {
				uploadedUrls.push(await uploadImage(file));
			} catch {
				setUploadError("Error al subir una imagen. Intenta de nuevo.");
				return;
			} finally {
				setUploadingCount((c) => Math.max(0, c - 1));
			}
		}

		const next = [...localAttachments, ...uploadedUrls];
		const previous = localAttachments;
		setLocalAttachments(next);

		try {
			await updateAttachments.mutateAsync({ id: orderId, data: { attachments: next } });
		} catch {
			setLocalAttachments(previous);
		}
	}

	const handleFileDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			const files = e.dataTransfer.files;
			if (files.length > 0) void uploadFiles(Array.from(files));
		},
		[uploadFiles, isBusy],
	);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files;
			if (files && files.length > 0) void uploadFiles(Array.from(files));
			e.target.value = "";
		},
		[uploadFiles, isBusy],
	);

	async function handleRemove(url: string) {
		if (isBusy) return;
		const next = localAttachments.filter((item) => item !== url);
		setLocalAttachments(next);
		await updateAttachments.mutateAsync({ id: orderId, data: { attachments: next } });
	}

	return (
		<div className="space-y-3 rounded-lg border p-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h3 className="font-medium text-sm">Adjuntos</h3>
					<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs tabular-nums">
						{localAttachments.length}/{MAX_ATTACHMENTS}
					</span>
				</div>
				{hasRoom && localAttachments.length > 0 && (
					<Button
						variant="outline"
						size="sm"
						type="button"
						disabled={isBusy}
						onClick={() => fileInputRef.current?.click()}
					>
						<HugeiconsIcon icon={Image01Icon} className="size-3.5" />
						Agregar
					</Button>
				)}
			</div>

			{uploadError && (
				<p className="text-destructive text-sm" role="alert">
					{uploadError}
				</p>
			)}

			{/* Upload zone — only when empty */}
			{localAttachments.length === 0 && hasRoom && (
				<div
					className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${
						isDragging
							? "border-dashed border-primary bg-primary/5"
							: "cursor-pointer border-dashed border-muted-foreground/25 bg-muted/30 hover:border-primary hover:bg-primary/5"
					} ${isBusy ? "cursor-not-allowed opacity-50" : ""}`}
					onDragEnter={(e) => {
						e.preventDefault();
						setIsDragging(true);
					}}
					onDragLeave={(e) => {
						e.preventDefault();
						setIsDragging(false);
					}}
					onDragOver={(e) => e.preventDefault()}
					onDrop={handleFileDrop}
				>
					<div
						role="button"
						tabIndex={0}
						className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 p-6 text-center"
						onClick={() => !isBusy && fileInputRef.current?.click()}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								fileInputRef.current?.click();
							}
						}}
					>
						<div className="rounded-full bg-primary/10 p-3">
							<HugeiconsIcon icon={CloudUploadIcon} className="size-6 text-primary" />
						</div>
						<div className="space-y-1">
							<p className="text-sm font-medium text-foreground">
								Arrastra imágenes o haz clic para seleccionar
							</p>
							<p className="text-muted-foreground/60 text-xs">
								PNG, JPG, WEBP o AVIF. Máx {MAX_FILE_BYTES / (1024 * 1024)} MB c/u.
							</p>
						</div>
					</div>
				</div>
			)}

			<input
				ref={fileInputRef}
				type="file"
				accept={ACCEPTED_IMAGE_TYPES}
				multiple
				className="sr-only"
				onChange={handleFileSelect}
				disabled={isBusy}
			/>

			{/* Image grid */}
			{localAttachments.length > 0 && (
				<div
					className="grid grid-cols-2 gap-2 overflow-hidden sm:grid-cols-3 md:grid-cols-4"
					onDragEnter={(e) => {
						e.preventDefault();
						setIsDragging(true);
					}}
					onDragLeave={(e) => {
						e.preventDefault();
						setIsDragging(false);
					}}
					onDragOver={(e) => e.preventDefault()}
					onDrop={handleFileDrop}
				>
					{localAttachments.map((url, index) => (
						<div
							key={`${url}-${index}`}
							className="group/image relative aspect-square overflow-hidden rounded-lg border bg-muted"
						>
							<img
								src={url}
								alt={`Adjunto ${index + 1}`}
								className="h-full w-full object-cover"
								draggable={false}
								loading="lazy"
							/>

							<div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 transition-all duration-200 group-hover/image:bg-black/40 opacity-0 group-hover/image:opacity-100">
								<a
									href={url}
									target="_blank"
									rel="noopener noreferrer"
									className={cn(
										buttonVariants({ variant: "secondary", size: "icon-sm" }),
										"size-7",
									)}
									onClick={(e) => e.stopPropagation()}
								>
									<HugeiconsIcon icon={Search01Icon} className="size-3.5" />
									<span className="sr-only">Ver</span>
								</a>
								<Button
									type="button"
									variant="destructive"
									size="icon-sm"
									className="size-7"
									onClick={(e) => {
										e.stopPropagation();
										void handleRemove(url);
									}}
									disabled={isBusy}
								>
									<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
									<span className="sr-only">Eliminar</span>
								</Button>
							</div>
						</div>
					))}

					{/* Add slot in grid */}
					{hasRoom && (
						<button
							type="button"
							className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
							onClick={() => !isBusy && fileInputRef.current?.click()}
							disabled={isBusy}
						>
							<HugeiconsIcon icon={Image01Icon} className="size-5 text-muted-foreground" />
							<span className="text-[10px] text-muted-foreground">Agregar</span>
						</button>
					)}
				</div>
			)}

			{uploadingCount > 0 && (
				<p className="text-muted-foreground text-xs">
					Subiendo {uploadingCount} {uploadingCount === 1 ? "imagen" : "imágenes"}…
				</p>
			)}
			{updateAttachments.isPending && !uploadingCount && (
				<p className="text-muted-foreground text-xs">Guardando cambios…</p>
			)}
		</div>
	);
}
