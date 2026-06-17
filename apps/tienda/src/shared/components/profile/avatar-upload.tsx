import { Cancel01Icon, Delete01Icon, ImageUploadIcon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from "@renovabit/ui/components/ui/alert-dialog";
import { Button } from "@renovabit/ui/components/ui/button";
import { cn } from "@renovabit/ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes, useFileUpload } from "@/shared/hooks/use-file-upload";

// ── Props ──────────────────────────────────────────

interface AvatarUploadProps {
	currentImage?: string | null;
	userName: string;
	onFileChange: (file: File | null) => void;
	onRemove: () => void;
	maxSize?: number;
	className?: string;
}

// ── Constants ──────────────────────────────────────

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/avif";

// ── Component ──────────────────────────────────────

export function AvatarUpload({
	currentImage,
	userName,
	onFileChange,
	onRemove,
	maxSize = 5 * 1024 * 1024,
	className,
}: AvatarUploadProps) {
	const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

	const [{ files, isDragging, errors }, { removeFile, openFileDialog, getInputProps }] =
		useFileUpload({
			maxFiles: 1,
			maxSize,
			accept: ACCEPTED_TYPES,
			multiple: false,
		});

	// Sync file changes to parent via useEffect — avoids setState during render
	const prevFilesRef = useRef(files);
	useEffect(() => {
		const prev = prevFilesRef.current;
		prevFilesRef.current = files;
		if (files === prev) return;

		const file = files[0];
		if (file?.file instanceof File) {
			onFileChange(file.file);
		} else if (prev.length > 0 && files.length === 0) {
			onFileChange(null);
		}
	}, [files, onFileChange]);

	const handleRemoveClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			// If it's an unsaved local file, remove instantly
			if (files[0]) {
				removeFile(files[0].id);
				onFileChange(null);
				return;
			}
			// Otherwise confirm removal of the saved image
			setIsRemoveDialogOpen(true);
		},
		[files, removeFile, onFileChange],
	);

	const handleRemoveConfirm = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			onRemove();
			setIsRemoveDialogOpen(false);
		},
		[onRemove],
	);

	const currentFile = files[0];
	const hasImage = Boolean(currentFile?.preview || currentImage);
	const previewUrl = currentFile?.preview ?? currentImage ?? undefined;

	return (
		<div className={cn("flex flex-col items-center gap-4", className)}>
			{/* Avatar Preview */}
			<div className="relative">
				<div
					role="button"
					tabIndex={0}
					className={cn(
						"group/avatar relative flex size-24 cursor-pointer items-center justify-center overflow-hidden rounded-full transition-all",
						hasImage
							? "border-2 border-border bg-muted/50"
							: "border-2 border-dashed border-muted-foreground/25 bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50",
						isDragging && "border-primary bg-primary/5",
					)}
					onClick={openFileDialog}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							openFileDialog();
						}
					}}
					aria-label={`Cambiar foto de perfil de ${userName}`}
				>
					<input {...getInputProps({ tabIndex: -1 })} className="sr-only" aria-hidden />

					{previewUrl ? (
						<img
							src={previewUrl}
							alt={`Avatar de ${userName}`}
							className="h-full w-full object-cover"
						/>
					) : (
						<HugeiconsIcon icon={UserIcon} className="text-muted-foreground size-8" />
					)}

					{/* Hover overlay */}
					<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover/avatar:opacity-100">
						<HugeiconsIcon icon={ImageUploadIcon} className="text-white size-5" />
					</div>
				</div>

				{/* Remove button */}
				{hasImage && (
					<Button
						size="icon"
						variant="outline"
						onClick={handleRemoveClick}
						className={cn(
							"absolute -end-1 -top-1 z-10 size-6 rounded-full",
							"bg-background border-border shadow-sm",
							"dark:bg-card",
							"hover:bg-destructive hover:text-destructive-foreground hover:border-destructive",
						)}
						aria-label={currentFile ? "Cancelar subida" : "Eliminar foto"}
					>
						<HugeiconsIcon icon={Cancel01Icon} className="size-3" />
					</Button>
				)}
			</div>

			{/* Instructions */}
			<div className="space-y-0.5 text-center">
				<p className="text-sm font-medium text-foreground">
					{currentFile ? "Foto seleccionada" : "Foto de perfil"}
				</p>
				<p className="text-muted-foreground text-xs">
					JPEG, PNG, WebP o AVIF. Hasta {formatBytes(maxSize)}.
				</p>
			</div>

			{/* Error Messages */}
			{errors.length > 0 && (
				<div
					role="alert"
					className="w-full rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
				>
					{errors.map((error) => (
						<p key={error}>{error}</p>
					))}
				</div>
			)}

			{/* Remove Confirmation Dialog */}
			<AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
							<HugeiconsIcon icon={Delete01Icon} />
						</AlertDialogMedia>
						<AlertDialogTitle>Eliminar foto de perfil</AlertDialogTitle>
						<AlertDialogDescription>
							¿Estás seguro de que deseas eliminar tu foto de perfil?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel variant="ghost">Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleRemoveConfirm} variant="destructive">
							Eliminar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
