import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Add01Icon,
	Cancel01Icon,
	CloudUploadIcon,
	Delete01Icon,
	Image01Icon,
	Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@renovabit/ui/components/ui/dialog";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@renovabit/ui/components/ui/field";
import { Input } from "@renovabit/ui/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@renovabit/ui/components/ui/select";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { Switch } from "@renovabit/ui/components/ui/switch";
import { Textarea } from "@renovabit/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBrands } from "@/features/brands/hooks";
import { useCategories } from "@/features/categories/hooks";
import { getFieldErrorId, normalizeFieldErrors } from "@/shared/lib/form/form-utils";
import { generateSlug } from "@/shared/lib/slug";
import { uploadImage } from "@/shared/lib/storage/storage-service";
import { productKeys } from "../hooks/products-queries";
import {
	type CreateProductValues,
	PRODUCT_DESCRIPTION_MAX,
	PRODUCT_IMAGE_MAX_BYTES,
	PRODUCT_IMAGES_MAX,
	PRODUCT_SEO_DESCRIPTION_MAX,
	PRODUCT_SEO_KEYWORDS_MAX,
	PRODUCT_SEO_TITLE_MAX,
	PRODUCT_SKU_MAX,
	PRODUCT_SPECS_MAX,
	type ProductFormValues,
	type ProductSpecification,
	type ProductStatus,
	productFormSchema,
} from "../model";
import { productImagesService } from "../service/product-images.service";

// ── Constants ────────────────────────────────────────────

export const PRODUCT_FORM_ID = "product-form";

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";

const STATUS_OPTIONS = [
	{ value: "active", label: "Activo" },
	{ value: "inactive", label: "Inactivo" },
] as const;

// ── Sortable Image Item ─────────────────────────────
// Diseño original: aspect-square, object-cover, overlay clásico

function SortableImageItem({
	id,
	src,
	alt,
	isPrimary,
	onRemove,
	onZoom,
}: {
	id: string;
	src: string;
	alt: string;
	isPrimary: boolean;
	onRemove: () => void;
	onZoom: () => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging: isSortDragging,
	} = useSortable({ id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`group/image relative aspect-square overflow-hidden rounded-lg border bg-background ${
				isSortDragging ? "z-50 opacity-60" : ""
			}`}
		>
			<img
				src={src}
				alt={alt}
				className="h-full w-full rounded-lg object-cover"
				draggable={false}
			/>
			{isPrimary && (
				<div className="absolute left-1 top-1 rounded bg-primary/80 px-1.5 py-0.5 text-[10px] text-white">
					Principal
				</div>
			)}

			{/* Hover overlay clásico */}
			<div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/0 transition-all duration-200 group-hover/image:bg-black/40 opacity-0 group-hover/image:opacity-100">
				<Button
					type="button"
					variant="secondary"
					size="icon-sm"
					className="size-7"
					onClick={(e) => {
						e.stopPropagation();
						onZoom();
					}}
				>
					<HugeiconsIcon icon={Search01Icon} className="size-3.5" />
					<span className="sr-only">Ampliar</span>
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="icon-sm"
					className="size-7"
					onClick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
				>
					<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
					<span className="sr-only">Eliminar</span>
				</Button>
			</div>

			{/* Barra inferior con nombre + drag handle */}
			<div
				{...attributes}
				{...listeners}
				className="absolute right-0 bottom-0 left-0 flex cursor-grab items-center gap-1 rounded-b-lg bg-black/70 p-1.5 text-white opacity-0 transition-opacity group-hover/image:opacity-100 active:cursor-grabbing"
			>
				<span className="truncate text-xs font-medium">{alt}</span>
			</div>
		</div>
	);
}

// ── Helpers ──────────────────────────────────────────────

export function toApiValue(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}

function getDefaultFormValues(props: ProductFormProps): ProductFormValues {
	if (props.mode === "edit") {
		return {
			name: props.product.name,
			slug: props.product.slug,
			description: props.product.description ?? "",
			sku: props.product.sku,
			price: props.product.price,
			stock: props.product.stock,
			brandId: props.product.brandId,
			categoryId: props.product.categoryId,
			specifications: props.product.specifications ?? [],
			status: props.product.status,
			isFeatured: props.product.isFeatured,
			seoTitle: props.product.seoTitle ?? "",
			seoDescription: props.product.seoDescription ?? "",
			seoKeywords: props.product.seoKeywords ?? "",
		};
	}
	return props.defaultValues;
}

// ── Props ────────────────────────────────────────────────

interface ProductFormCreateProps {
	mode?: "create";
	defaultValues: ProductFormValues;
	onMutation: (data: CreateProductValues) => Promise<unknown>;
	onSuccess: () => void;
	onSubmittingChange?: (isSubmitting: boolean) => void;
}

interface ProductFormEditProps {
	mode: "edit";
	product: {
		id: string;
		name: string;
		slug: string;
		description: string | null;
		sku: string;
		price: string;
		stock: number;
		brandId: string | null;
		categoryId: string | null;
		specifications: ProductSpecification[];
		status: ProductStatus;
		isFeatured: boolean;
		seoTitle: string | null;
		seoDescription: string | null;
		seoKeywords: string | null;
	};
	onMutation: (data: CreateProductValues) => Promise<unknown>;
	onSuccess: () => void;
	onSubmittingChange?: (isSubmitting: boolean) => void;
}

export type ProductFormProps = ProductFormCreateProps | ProductFormEditProps;

// ── Component ────────────────────────────────────────────

export function ProductForm(props: ProductFormProps) {
	const { onMutation, onSuccess } = props;
	const isEdit = props.mode === "edit";
	const queryClient = useQueryClient();

	const defaultValues: ProductFormValues = getDefaultFormValues(props);

	const slugManuallyEditedRef = useRef(isEdit);

	// Image state — IDs unificados para SortableContext
	const [imageFiles, setImageFiles] = useState<Array<{ file: File; preview: string; id: string }>>(
		[],
	);
	const [existingImages, setExistingImages] = useState<
		Array<{
			id: string;
			url: string;
			alt: string | null;
			sortOrder: number | null;
			isPrimary: boolean;
		}>
	>([]);
	const [imageOrder, setImageOrder] = useState<string[]>([]);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [imageError, setImageError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const prevSubmittingRef = useRef(false);
	const { onSubmittingChange } = props;

	// Load brands & categories for selects
	const { data: brandsData } = useBrands();
	const { data: categoriesData } = useCategories();

	const brands = useMemo(() => brandsData ?? [], [brandsData]);
	const categories = useMemo(() => categoriesData ?? [], [categoriesData]);

	// Notificar al wrapper cuando cambia isSubmitting
	useEffect(() => {
		if (onSubmittingChange && prevSubmittingRef.current !== isSubmitting) {
			prevSubmittingRef.current = isSubmitting;
			onSubmittingChange(isSubmitting);
		}
	}, [isSubmitting, onSubmittingChange]);

	// Cargar imágenes existentes en modo edición
	useEffect(() => {
		if (!isEdit) return;
		const productId = props.product.id;

		productImagesService
			.listByProduct(productId)
			.then((images) => {
				setExistingImages(images);
				setImageOrder(images.map((img) => img.id));
			})
			.catch(() => {
				// Error silencioso — las imágenes existentes no son críticas
			});
	}, [isEdit ? props.product.id : null]);

	const form = useForm({
		defaultValues,
		validators: {
			onChange: productFormSchema,
			onSubmit: productFormSchema,
		},
		onSubmit: async ({ value }) => {
			setIsSubmitting(true);
			setImageError(null);

			try {
				// 1. Upload ONLY new images to R2 (existing images ya están en R2)
				const newImageMapping: Array<{ localId: string; url: string }> = [];
				for (const item of imageFiles) {
					try {
						const url = await uploadImage(item.file);
						newImageMapping.push({ localId: item.id, url });
					} catch {
						setImageError(`Error al subir la imagen "${item.file.name}"`);
						return;
					}
				}

				// 2. Create or update product
				const result = await onMutation({
					name: value.name,
					slug: value.slug,
					description: toApiValue(value.description),
					sku: value.sku,
					price: value.price,
					stock: value.stock,
					brandId: value.brandId ?? null,
					categoryId: value.categoryId ?? null,
					specifications: value.specifications,
					status: value.status,
					isFeatured: value.isFeatured,
					seoTitle: toApiValue(value.seoTitle),
					seoDescription: toApiValue(value.seoDescription),
					seoKeywords: toApiValue(value.seoKeywords),
				});

				const targetProductId = isEdit
					? props.product.id
					: (result as { id: string } | undefined)?.id;

				if (!targetProductId) {
					onSuccess();
					return;
				}

				// 3. Persistir el orden de todas las imágenes según imageOrder (paralelo)
				const imageOps = imageOrder.map(async (imgId, position) => {
					const isPrimary = position === 0;

					// ¿Es una imagen nueva (subida en esta sesión)?
					const newMapping = newImageMapping.find((m) => m.localId === imgId);
					if (newMapping) {
						await productImagesService.create({
							productId: targetProductId,
							url: newMapping.url,
							sortOrder: position,
							isPrimary,
						});
						return;
					}

					// ¿Es una imagen existente cuyo orden o primary cambió?
					const existing = existingImages.find((e) => e.id === imgId);
					if (!existing) return;

					const sortOrderChanged = existing.sortOrder !== position;
					const primaryChanged = existing.isPrimary !== isPrimary;

					if (sortOrderChanged || primaryChanged) {
						await productImagesService.update(existing.id, {
							sortOrder: position,
							isPrimary,
						});
					}
				});

				await Promise.all(imageOps);
				// Invalidar queries para que la tabla se actualice con el nuevo orden
				queryClient.invalidateQueries({ queryKey: productKeys.lists() });

				onSuccess();
			} finally {
				setIsSubmitting(false);
			}
		},
	});

	// ── Image handlers ─────────────────────────────────

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		setImageOrder((prev) => {
			const oldIndex = prev.indexOf(active.id as string);
			const newIndex = prev.indexOf(over.id as string);
			if (oldIndex === -1 || newIndex === -1) return prev;
			return arrayMove(prev, oldIndex, newIndex);
		});
	}

	function addImagesBatch(incomingFiles: File[]) {
		setImageError(null);

		const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
		let errorMsg: string | null = null;
		const newItems: Array<{ file: File; preview: string; id: string }> = [];

		// Functional updater: siempre ve el estado MÁS RECIENTE de imageFiles,
		// incluso si addImagesBatch se llama múltiples veces antes de un re-render
		setImageFiles((currentFiles) => {
			const currentTotal = currentFiles.length + existingImages.length;
			let remaining = PRODUCT_IMAGES_MAX - currentTotal;

			for (const file of incomingFiles) {
				if (remaining <= 0) {
					errorMsg = `Máximo ${PRODUCT_IMAGES_MAX} imágenes por producto.`;
					break;
				}

				if (!allowedTypes.includes(file.type)) {
					if (!errorMsg) errorMsg = "Formato no soportado. Usa PNG, JPG o WEBP.";
					continue;
				}
				if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
					if (!errorMsg)
						errorMsg = `La imagen no puede superar ${PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024)} MB.`;
					continue;
				}

				newItems.push({
					file,
					preview: URL.createObjectURL(file),
					id: crypto.randomUUID(),
				});
				remaining--;
			}

			if (errorMsg) setImageError(errorMsg);

			return [...currentFiles, ...newItems];
		});

		if (newItems.length > 0) {
			setImageOrder((prev) => [...prev, ...newItems.map((i) => i.id)]);
		}
	}

	function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
		const files = e.target.files;
		if (!files) return;
		addImagesBatch(Array.from(files));
		e.target.value = "";
	}

	function handleFileDrop(e: React.DragEvent) {
		e.preventDefault();
		setIsDragging(false);
		const files = e.dataTransfer.files;
		if (!files) return;
		addImagesBatch(Array.from(files));
	}

	function handleRemoveImage(imageId: string) {
		setImageFiles((prev) => {
			const item = prev.find((i) => i.id === imageId);
			if (item?.preview.startsWith("blob:")) {
				URL.revokeObjectURL(item.preview);
			}
			return prev.filter((i) => i.id !== imageId);
		});
		setImageOrder((prev) => prev.filter((id) => id !== imageId));
	}

	async function handleRemoveExistingImage(imageId: string) {
		try {
			await productImagesService.delete(imageId);
			setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
			setImageOrder((prev) => prev.filter((id) => id !== imageId));
		} catch {
			setImageError("Error al eliminar la imagen");
		}
	}

	function handleZoom(url: string) {
		setPreviewUrl(url);
	}

	// ── Specifications handlers ─────────────────────────

	function addSpecification() {
		const current = form.getFieldValue("specifications");
		const newSpec: ProductSpecification = { id: crypto.randomUUID(), key: "", value: "" };
		form.setFieldValue("specifications", [...current, newSpec]);
	}

	function removeSpecification(index: number) {
		const current = form.getFieldValue("specifications");
		form.setFieldValue(
			"specifications",
			current.filter((_: unknown, i: number) => i !== index),
		);
	}

	// ── Render helpers ─────────────────────────────────

	return (
		<form
			id={PRODUCT_FORM_ID}
			className="flex flex-col gap-5"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			noValidate
		>
			{/* ═════════════════════════════════════════════
					INFORMACIÓN BÁSICA
				═════════════════════════════════════════════ */}
			<header className="flex flex-col">
				<h3 className="font-medium text-foreground text-sm">Información básica</h3>
			</header>

			<FieldGroup>
				{/* ── Name ── */}
				<form.Field name="name">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

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
									onChange={(e) => {
										const v = e.target.value;
										field.handleChange(v);
										if (!slugManuallyEditedRef.current) {
											form.setFieldValue("slug", generateSlug(v));
										}
									}}
									onBlur={field.handleBlur}
									placeholder="Ej: Laptop ASUS ROG Zephyrus G14"
									disabled={isSubmitting}
									aria-invalid={isInvalid}
									aria-describedby={isInvalid ? errorMessageId : undefined}
									maxLength={255}
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

				{/* ── Slug ── */}
				<form.Field name="slug">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>
									<span>
										Slug{" "}
										<span aria-hidden="true" className="text-destructive">
											*
										</span>
										<span className="sr-only">obligatorio</span>
									</span>
								</FieldLabel>
								<FieldDescription>
									Se genera automáticamente al escribir el nombre. Puedes editarlo manualmente.
								</FieldDescription>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => {
										slugManuallyEditedRef.current = true;
										field.handleChange(e.target.value);
									}}
									onBlur={field.handleBlur}
									placeholder="laptop-asus-rog-zephyrus-g14"
									disabled={isSubmitting}
									className="font-mono text-sm"
									aria-invalid={isInvalid}
									aria-describedby={isInvalid ? errorMessageId : undefined}
									maxLength={255}
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

				{/* ── SKU ── */}
				<form.Field name="sku">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>
									<span>
										SKU{" "}
										<span aria-hidden="true" className="text-destructive">
											*
										</span>
										<span className="sr-only">obligatorio</span>
									</span>
								</FieldLabel>
								<FieldDescription>Código único de identificación del producto.</FieldDescription>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="ASUS-ROG-G14-2024"
									disabled={isSubmitting}
									className="font-mono text-sm"
									aria-invalid={isInvalid}
									aria-describedby={isInvalid ? errorMessageId : undefined}
									maxLength={PRODUCT_SKU_MAX}
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

				{/* ── Description ── */}
				<form.Field name="description">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Descripción</FieldLabel>
								<Textarea
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Descripción detallada del producto..."
									rows={4}
									disabled={isSubmitting}
									aria-invalid={isInvalid}
									aria-describedby={isInvalid ? errorMessageId : undefined}
									maxLength={PRODUCT_DESCRIPTION_MAX}
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

			<Separator />

			{/* ═════════════════════════════════════════════
					PRECIO Y STOCK
				═════════════════════════════════════════════ */}
			<header className="flex flex-col">
				<h3 className="font-medium text-foreground text-sm">Precio y stock</h3>
			</header>

			<FieldGroup>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
					{/* ── Price ── */}
					<form.Field name="price">
						{(field) => {
							const wasSubmitted = field.form.state.submissionAttempts > 0;
							const isInvalid =
								(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
							const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

							return (
								<Field className="sm:flex-1" data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										<span>
											Precio (S/){" "}
											<span aria-hidden="true" className="text-destructive">
												*
											</span>
											<span className="sr-only">obligatorio</span>
										</span>
									</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="text"
										inputMode="decimal"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										placeholder="99.99"
										disabled={isSubmitting}
										className="font-mono tabular-nums"
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

					{/* ── Stock ── */}
					<form.Field name="stock">
						{(field) => {
							const wasSubmitted = field.form.state.submissionAttempts > 0;
							const isInvalid =
								(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
							const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

							return (
								<Field className="sm:w-32" data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Stock</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="number"
										min={0}
										step={1}
										value={field.state.value}
										onChange={(e) =>
											field.handleChange(
												e.target.value === "" ? 0 : Number.parseInt(e.target.value, 10),
											)
										}
										onBlur={field.handleBlur}
										placeholder="0"
										disabled={isSubmitting}
										className="font-mono tabular-nums"
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

					{/* ── Status ── */}
					<form.Field name="status">
						{(field) => {
							const wasSubmitted = field.form.state.submissionAttempts > 0;
							const isInvalid =
								(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
							const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

							return (
								<Field className="sm:w-40" data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Estado</FieldLabel>
									<Select
										value={field.state.value}
										onValueChange={(val) => field.handleChange(val as ProductStatus)}
										disabled={isSubmitting}
									>
										<SelectTrigger id={field.name} aria-invalid={isInvalid}>
											<SelectValue placeholder="Seleccionar estado" className="sr-only" />
											<span className="flex-1 text-left">
												{STATUS_OPTIONS.find((o) => o.value === field.state.value)?.label ??
													"Seleccionar estado"}
											</span>
										</SelectTrigger>
										<SelectContent>
											{STATUS_OPTIONS.map((opt) => (
												<SelectItem key={opt.value} value={opt.value}>
													{opt.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
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
				</div>
			</FieldGroup>

			<Separator />

			{/* ═════════════════════════════════════════════
					RELACIONES
				═════════════════════════════════════════════ */}
			<header className="flex flex-col">
				<h3 className="font-medium text-foreground text-sm">Relaciones</h3>
				<FieldDescription>Asocia el producto a una marca y/o categoría.</FieldDescription>
			</header>

			<FieldGroup>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
					{/* ── Brand ── */}
					<form.Field name="brandId">
						{(field) => {
							const wasSubmitted = field.form.state.submissionAttempts > 0;
							const isInvalid =
								(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
							const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

							return (
								<Field className="sm:flex-1" data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Marca</FieldLabel>
									<FieldDescription>Opcional. Deja vacío si no aplica.</FieldDescription>
									<Select
										value={field.state.value ?? undefined}
										onValueChange={(val) => field.handleChange(val || null)}
										disabled={isSubmitting}
									>
										<SelectTrigger id={field.name} aria-invalid={isInvalid}>
											<SelectValue placeholder="Sin marca" className="sr-only" />
											<span className="flex-1 text-left">
												{field.state.value
													? (brands.find((b) => b.id === field.state.value)?.name ??
														field.state.value)
													: "Sin marca"}
											</span>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="">Sin marca</SelectItem>
											{brands.map((brand) => (
												<SelectItem key={brand.id} value={brand.id}>
													{brand.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
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

					{/* ── Category ── */}
					<form.Field name="categoryId">
						{(field) => {
							const wasSubmitted = field.form.state.submissionAttempts > 0;
							const isInvalid =
								(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
							const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

							return (
								<Field className="sm:flex-1" data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Categoría</FieldLabel>
									<FieldDescription>Opcional. Deja vacío si no aplica.</FieldDescription>
									<Select
										value={field.state.value ?? undefined}
										onValueChange={(val) => field.handleChange(val || null)}
										disabled={isSubmitting}
									>
										<SelectTrigger id={field.name} aria-invalid={isInvalid}>
											<SelectValue placeholder="Sin categoría" className="sr-only" />
											<span className="flex-1 text-left">
												{field.state.value
													? (categories.find((c) => c.id === field.state.value)?.name ??
														field.state.value)
													: "Sin categoría"}
											</span>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="">Sin categoría</SelectItem>
											{categories.map((cat) => (
												<SelectItem key={cat.id} value={cat.id}>
													{cat.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
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
				</div>
			</FieldGroup>

			<Separator />

			{/* ═════════════════════════════════════════════
					ESPECIFICACIONES
				═════════════════════════════════════════════ */}
			<form.Field name="specifications">
				{(field) => {
					const specs = field.state.value;

					return (
						<Field>
							<header className="flex items-center justify-between">
								<div className="flex flex-col">
									<h3 className="font-medium text-foreground text-sm">Especificaciones técnicas</h3>
									<FieldDescription>
										Agrega características del producto como color, tamaño, material, etc.
									</FieldDescription>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={addSpecification}
									disabled={isSubmitting || specs.length >= PRODUCT_SPECS_MAX}
								>
									<HugeiconsIcon icon={Add01Icon} className="mr-1 size-3.5" />
									Agregar
								</Button>
							</header>

							{specs.length === 0 ? (
								<p className="text-muted-foreground py-2 text-sm">
									Sin especificaciones. Haz clic en "Agregar" para añadir.
								</p>
							) : (
								<div className="flex flex-col gap-2">
									{specs.map((_: ProductSpecification, index: number) => (
										<div key={index} className="flex items-start gap-2">
											<div className="flex flex-1 flex-col gap-2 sm:flex-row">
												<form.Field name={`specifications[${index}].key`}>
													{(subField) => (
														<Input
															id={subField.name}
															name={subField.name}
															value={subField.state.value}
															onChange={(e) => subField.handleChange(e.target.value)}
															placeholder="Ej: Color"
															disabled={isSubmitting}
															className="sm:w-40"
														/>
													)}
												</form.Field>
												<form.Field name={`specifications[${index}].value`}>
													{(subField) => (
														<Input
															id={subField.name}
															name={subField.name}
															value={subField.state.value}
															onChange={(e) => subField.handleChange(e.target.value)}
															placeholder="Ej: Rosa"
															disabled={isSubmitting}
															className="flex-1"
														/>
													)}
												</form.Field>
											</div>
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												className="mt-0.5 h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
												onClick={() => removeSpecification(index)}
												disabled={isSubmitting}
											>
												<HugeiconsIcon icon={Delete01Icon} className="size-4" />
												<span className="sr-only">Eliminar especificación</span>
											</Button>
										</div>
									))}
								</div>
							)}

							<div className="text-muted-foreground text-xs">
								{specs.length}/{PRODUCT_SPECS_MAX} especificaciones
							</div>
						</Field>
					);
				}}
			</form.Field>

			<Separator />

			{/* ═════════════════════════════════════════════
					IMÁGENES
				═════════════════════════════════════════════ */}
			<Field>
				<header className="flex flex-col">
					<h3 className="font-medium text-foreground text-sm">Galería de imágenes</h3>
					<FieldDescription>
						Opcional. PNG, JPG o WEBP. Máximo {PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024)} MB cada una.
						Hasta {PRODUCT_IMAGES_MAX} imágenes.
					</FieldDescription>
				</header>

				<input
					ref={fileInputRef}
					type="file"
					accept={ACCEPTED_IMAGE_TYPES}
					multiple
					className="sr-only"
					onChange={handleImageSelect}
					disabled={isSubmitting}
				/>

				{imageError && (
					<p className="text-destructive text-sm" role="alert">
						{imageError}
					</p>
				)}

				{/* Upload zone */}
				<div
					className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${
						isDragging
							? "border-dashed border-primary bg-primary/5"
							: "cursor-pointer border-dashed border-muted-foreground/25 bg-muted/30 hover:border-primary hover:bg-primary/5"
					} ${isSubmitting ? "cursor-not-allowed opacity-50" : ""}`}
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
						onClick={() => !isSubmitting && fileInputRef.current?.click()}
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
								PNG, JPG o WEBP. Máximo {PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024)} MB cada una.
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							type="button"
							disabled={isSubmitting}
							onClick={(e) => {
								e.stopPropagation();
								fileInputRef.current?.click();
							}}
						>
							<HugeiconsIcon icon={Image01Icon} className="size-3.5" />
							Seleccionar imágenes
						</Button>
					</div>
				</div>

				{/* Image grid with DnD — multi-row sortable */}
				{(imageFiles.length > 0 || existingImages.length > 0) && (
					<div className="mt-3">
						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
						>
							<SortableContext items={imageOrder}>
								<div className="grid grid-cols-2 gap-3 overflow-hidden sm:grid-cols-3 md:grid-cols-4">
									{imageOrder.map((imgId) => {
										const existing = existingImages.find((e) => e.id === imgId);
										if (existing) {
											return (
												<SortableImageItem
													key={existing.id}
													id={existing.id}
													src={existing.url}
													alt={existing.alt ?? "Imagen del producto"}
													isPrimary={existing.isPrimary}
													onRemove={() => handleRemoveExistingImage(existing.id)}
													onZoom={() => handleZoom(existing.url)}
												/>
											);
										}
										const newUpload = imageFiles.find((f) => f.id === imgId);
										if (newUpload) {
											return (
												<SortableImageItem
													key={newUpload.id}
													id={newUpload.id}
													src={newUpload.preview}
													alt={newUpload.file.name}
													isPrimary={false}
													onRemove={() => handleRemoveImage(newUpload.id)}
													onZoom={() => handleZoom(newUpload.preview)}
												/>
											);
										}
										return null;
									})}
								</div>
							</SortableContext>
						</DndContext>
					</div>
				)}

				{(imageFiles.length > 0 || existingImages.length > 0) && (
					<div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
						<span>
							{existingImages.length + imageFiles.length}/{PRODUCT_IMAGES_MAX} imágenes
							{imageFiles.length > 0 && ` (${imageFiles.length} nuevas)`}
						</span>
						<span aria-hidden="true">·</span>
						<span>Arrastra para reordenar</span>
					</div>
				)}

				{/* Image preview dialog */}
				<Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
					<DialogContent
						showCloseButton={false}
						className="flex max-h-[80vh] max-w-2xl items-center justify-center border bg-background p-4 shadow-lg"
					>
						<DialogClose
							render={
								<Button
									variant="outline"
									size="icon-sm"
									className="absolute top-2 right-2 z-10 size-7"
								>
									<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
									<span className="sr-only">Cerrar</span>
								</Button>
							}
						/>
						<DialogHeader className="sr-only">
							<DialogTitle>Vista previa</DialogTitle>
						</DialogHeader>
						{previewUrl && (
							<img
								src={previewUrl}
								alt="Vista previa"
								className="max-h-[70vh] max-w-full rounded-lg object-contain"
							/>
						)}
					</DialogContent>
				</Dialog>
			</Field>

			<Separator />

			{/* ═════════════════════════════════════════════
					VISIBILIDAD
				═════════════════════════════════════════════ */}
			<header className="flex flex-col">
				<h3 className="font-medium text-foreground text-sm">Visibilidad</h3>
				<FieldDescription>
					Controla si el producto está activo y si aparece como destacado.
				</FieldDescription>
			</header>

			<div className="flex flex-col gap-5 rounded-lg border p-4">
				<form.Field name="isFeatured">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

						return (
							<Field
								orientation="horizontal"
								className="items-center justify-between gap-4"
								data-invalid={isInvalid}
							>
								<div className="flex min-w-0 flex-col gap-1">
									<FieldLabel htmlFor={field.name} className="cursor-pointer">
										Producto destacado
									</FieldLabel>
									<FieldDescription>
										Aparece en la sección de productos destacados de la tienda.
									</FieldDescription>
									{isInvalid && (
										<FieldError
											id={errorMessageId}
											errors={normalizeFieldErrors(field.state.meta.errors)}
										/>
									)}
								</div>
								<Switch
									id={field.name}
									checked={field.state.value}
									onCheckedChange={(checked) => field.handleChange(checked)}
									disabled={isSubmitting}
								/>
							</Field>
						);
					}}
				</form.Field>
			</div>

			<Separator />

			{/* ═════════════════════════════════════════════
					SEO
				═════════════════════════════════════════════ */}
			<FieldGroup>
				<header className="flex flex-col">
					<h3 className="font-medium text-foreground text-sm">SEO</h3>
					<FieldDescription>
						Campos opcionales para mejorar la presencia en buscadores.
					</FieldDescription>
				</header>

				<form.Field name="seoTitle">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Título SEO</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Laptop ASUS ROG Zephyrus G14 — tienda de tecnología"
									maxLength={PRODUCT_SEO_TITLE_MAX}
									disabled={isSubmitting}
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

				<form.Field name="seoDescription">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Descripción SEO</FieldLabel>
								<Textarea
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Compra la laptop ASUS ROG Zephyrus G14 con envío a todo el país."
									rows={2}
									maxLength={PRODUCT_SEO_DESCRIPTION_MAX}
									disabled={isSubmitting}
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

				<form.Field name="seoKeywords">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(PRODUCT_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Palabras clave (SEO)</FieldLabel>
								<FieldDescription>
									Separadas por coma. Ej: laptop gaming, ASUS, Ryzen 9
								</FieldDescription>
								<Textarea
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="laptop, ASUS, ROG, Zephyrus, G14, gaming"
									rows={2}
									maxLength={PRODUCT_SEO_KEYWORDS_MAX}
									disabled={isSubmitting}
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
		</form>
	);
}
