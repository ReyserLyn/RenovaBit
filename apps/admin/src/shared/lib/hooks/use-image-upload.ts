import { useRef, useState } from "react";

interface UseImageUploadOptions {
	maxBytes: number;
	acceptedTypes?: string[];
	initialPreview?: string | null;
}

interface UseImageUploadResult {
	imageFile: File | null;
	imagePreview: string | null;
	imageError: string | null;
	setImageError: (v: string | null) => void;
	isDragging: boolean;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	handleImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
	handleFileDrop: (e: React.DragEvent) => void;
	handleRemoveImage: () => void;
	setIsDragging: (v: boolean) => void;
}

export function useImageUpload(options: UseImageUploadOptions): UseImageUploadResult {
	const defaultTypes = ["image/png", "image/jpeg", "image/webp"];
	const acceptedTypes = options.acceptedTypes ?? defaultTypes;

	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(options.initialPreview ?? null);
	const [imageError, setImageError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	function processFile(file: File) {
		if (!acceptedTypes.includes(file.type)) {
			setImageError("Formato no soportado. Usa PNG, JPG o WEBP.");
			return;
		}

		if (file.size > options.maxBytes) {
			setImageError(`La imagen no puede superar ${options.maxBytes / (1024 * 1024)} MB.`);
			return;
		}

		setImageError(null);
		setImageFile(file);

		// Revocar blob URL anterior si existe
		if (imagePreview?.startsWith("blob:")) {
			URL.revokeObjectURL(imagePreview);
		}
		setImagePreview(URL.createObjectURL(file));
	}

	function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (file) processFile(file);
	}

	function handleFileDrop(e: React.DragEvent) {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files?.[0];
		if (file) processFile(file);
	}

	function handleRemoveImage() {
		if (imagePreview?.startsWith("blob:")) {
			URL.revokeObjectURL(imagePreview);
		}
		setImageFile(null);
		setImagePreview(null);
		setImageError(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}

	return {
		imageFile,
		imagePreview,
		imageError,
		setImageError,
		isDragging,
		fileInputRef,
		handleImageSelect,
		handleFileDrop,
		handleRemoveImage,
		setIsDragging,
	};
}
