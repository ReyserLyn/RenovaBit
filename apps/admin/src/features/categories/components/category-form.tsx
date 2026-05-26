import {
	Cancel01Icon,
	CloudUploadIcon,
	Image01Icon,
	Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
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
import { useEffect, useRef, useState } from "react";
import { getFieldErrorId, normalizeFieldErrors } from "@/shared/lib/form/form-utils";
import { useImageUpload } from "@/shared/lib/hooks/use-image-upload";
import { generateSlug } from "@/shared/lib/slug";
import { uploadImage } from "@/shared/lib/storage/storage-service";
import { toApiValue } from "@/shared/lib/string";
import { useCategories } from "../hooks";
import {
	CATEGORY_DESCRIPTION_MAX,
	CATEGORY_IMAGE_MAX_BYTES,
	CATEGORY_NAME_MAX,
	CATEGORY_SEO_DESCRIPTION_MAX,
	CATEGORY_SEO_KEYWORDS_MAX,
	CATEGORY_SEO_TITLE_MAX,
	CATEGORY_SLUG_MAX,
	type CategoryFormValues,
	type CreateCategoryValues,
	categoryFormSchema,
} from "../model";

// ── Constants ────────────────────────────────────────────

export const CATEGORY_FORM_ID = "category-form";

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";

// ── Props ────────────────────────────────────────────────

interface CategoryFormCreateProps {
	mode?: "create";
	defaultValues: CategoryFormValues;
	onMutation: (data: CreateCategoryValues) => Promise<unknown>;
	onSuccess: () => void;
	onSubmittingChange?: (isSubmitting: boolean) => void;
}

interface CategoryFormEditProps {
	mode: "edit";
	category: {
		id: string;
		name: string;
		slug: string;
		description: string | null;
		imageUrl: string | null;
		parentId: string | null;
		path: string | null;
		sortOrder: number | null;
		isFeatured: boolean;
		isActive: boolean;
		isVisibleInNav: boolean;
		seoTitle: string | null;
		seoDescription: string | null;
		seoKeywords: string | null;
	};
	onMutation: (data: CreateCategoryValues) => Promise<unknown>;
	onSuccess: () => void;
	onSubmittingChange?: (isSubmitting: boolean) => void;
}

export type CategoryFormProps = CategoryFormCreateProps | CategoryFormEditProps;

// ── Component ────────────────────────────────────────────

export function CategoryForm(props: CategoryFormProps) {
	const { onMutation, onSuccess } = props;
	const isEdit = props.mode === "edit";

	const defaultValues: CategoryFormValues = isEdit
		? {
				name: props.category.name,
				slug: props.category.slug,
				description: props.category.description ?? "",
				parentId: props.category.parentId ?? undefined,
				sortOrder: props.category.sortOrder ?? 0,
				isFeatured: props.category.isFeatured,
				isActive: props.category.isActive,
				isVisibleInNav: props.category.isVisibleInNav,
				seoTitle: props.category.seoTitle ?? "",
				seoDescription: props.category.seoDescription ?? "",
				seoKeywords: props.category.seoKeywords ?? "",
			}
		: props.defaultValues;

	const existingImageUrl = isEdit ? props.category.imageUrl : undefined;
	const slugManuallyEditedRef = useRef(isEdit);

	// Image upload hook
	const {
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
	} = useImageUpload({
		maxBytes: CATEGORY_IMAGE_MAX_BYTES,
		initialPreview: existingImageUrl ?? null,
	});

	// Categorías disponibles para el selector de padre
	const { data: allCategories = [] } = useCategories();

	const [isSubmitting, setIsSubmitting] = useState(false);
	const prevSubmittingRef = useRef(false);
	const { onSubmittingChange } = props;

	// IDs a excluir del selector de padre (en edit: la categoría actual + sus descendientes)
	const descendantIds = (() => {
		if (!isEdit) return new Set<string>();
		const exclude = new Set<string>([props.category.id]);
		const pathPrefix = `${props.category.path ?? "/"}${props.category.id}/`;
		for (const cat of allCategories) {
			if (cat.path && cat.path.startsWith(pathPrefix)) {
				exclude.add(cat.id);
			}
		}
		return exclude;
	})();

	const parentOptions = allCategories.filter(
		(cat) => !descendantIds.has(cat.id) && cat.id !== (isEdit ? props.category.id : ""),
	);

	// Notificar al wrapper cuando cambia isSubmitting
	useEffect(() => {
		if (onSubmittingChange && prevSubmittingRef.current !== isSubmitting) {
			prevSubmittingRef.current = isSubmitting;
			onSubmittingChange(isSubmitting);
		}
	}, [isSubmitting, onSubmittingChange]);

	const form = useForm({
		defaultValues,
		validators: {
			onChange: categoryFormSchema,
			onSubmit: categoryFormSchema,
		},
		onSubmit: async ({ value }) => {
			setIsSubmitting(true);
			setImageError(null);

			try {
				let imageUrl: string | undefined;

				if (imageFile) {
					try {
						imageUrl = await uploadImage(imageFile);
					} catch (uploadError) {
						setImageError(
							uploadError instanceof Error ? uploadError.message : "Error al subir la imagen",
						);
						return;
					}
				} else if (imagePreview === null && existingImageUrl) {
					imageUrl = "";
				}

				await onMutation({
					name: value.name,
					slug: value.slug,
					description: toApiValue(value.description),
					parentId: value.parentId ?? null,
					sortOrder: value.sortOrder,
					isFeatured: value.isFeatured,
					isActive: value.isActive,
					isVisibleInNav: value.isVisibleInNav,
					seoTitle: toApiValue(value.seoTitle),
					seoDescription: toApiValue(value.seoDescription),
					seoKeywords: toApiValue(value.seoKeywords),
					...(imageUrl !== undefined && { imageUrl }),
				});

				onSuccess();
			} finally {
				setIsSubmitting(false);
				onSubmittingChange?.(false);
			}
		},
	});

	return (
		<form
			id={CATEGORY_FORM_ID}
			className="flex flex-col gap-5"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			noValidate
		>
			<FieldGroup>
				{/* ── Name ── */}
				<form.Field name="name">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(CATEGORY_FORM_ID, field.name);

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
									placeholder="Ej: Laptops, Periféricos, Audio"
									disabled={isSubmitting}
									aria-invalid={isInvalid}
									aria-describedby={isInvalid ? errorMessageId : undefined}
									maxLength={CATEGORY_NAME_MAX}
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
						const errorMessageId = getFieldErrorId(CATEGORY_FORM_ID, field.name);

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
									placeholder="laptops, perifericos, audio"
									disabled={isSubmitting}
									className="font-mono text-sm"
									aria-invalid={isInvalid}
									aria-describedby={isInvalid ? errorMessageId : undefined}
									maxLength={CATEGORY_SLUG_MAX}
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
						const errorMessageId = getFieldErrorId(CATEGORY_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Descripción</FieldLabel>
								<Textarea
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Categoría para productos de..."
									rows={3}
									disabled={isSubmitting}
									aria-invalid={isInvalid}
									aria-describedby={isInvalid ? errorMessageId : undefined}
									maxLength={CATEGORY_DESCRIPTION_MAX}
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

				{/* ── Parent category ── */}
				<form.Field name="parentId">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(CATEGORY_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Categoría padre</FieldLabel>
								<FieldDescription>Deja vacío para crear una categoría raíz.</FieldDescription>
								<Select
									value={field.state.value ?? undefined}
									onValueChange={(val) => {
										field.handleChange(val || undefined);
									}}
									disabled={isSubmitting}
								>
									<SelectTrigger
										id={field.name}
										aria-invalid={isInvalid}
										aria-describedby={isInvalid ? errorMessageId : undefined}
									>
										<SelectValue placeholder="Sin padre (raíz)" className="sr-only" />
										<span className="flex-1 text-left">
											{field.state.value
												? (parentOptions.find((c) => c.id === field.state.value)?.name ??
													field.state.value)
												: "Sin padre (raíz)"}
										</span>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">Sin padre (raíz)</SelectItem>
										{parentOptions.map((cat) => (
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

				{/* ── Sort order ── */}
				<form.Field name="sortOrder">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(CATEGORY_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Orden</FieldLabel>
								<FieldDescription>
									Número para ordenar manualmente las categorías (menor = primero).
								</FieldDescription>
								<Input
									id={field.name}
									name={field.name}
									type="number"
									min={0}
									value={field.state.value}
									onChange={(e) => field.handleChange(Number(e.target.value))}
									onBlur={field.handleBlur}
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

			<Separator />

			{/* ── Image Upload ── */}
			<Field>
				<header className="flex flex-col">
					<h3 className="font-medium text-foreground text-sm">Imagen de la categoría</h3>
					<FieldDescription>
						Opcional. PNG, JPG o WEBP. Máximo {CATEGORY_IMAGE_MAX_BYTES / (1024 * 1024)} MB.
					</FieldDescription>
				</header>

				<input
					ref={fileInputRef}
					type="file"
					accept={ACCEPTED_IMAGE_TYPES}
					className="sr-only"
					onChange={handleImageSelect}
					disabled={isSubmitting}
				/>

				{imageError && (
					<p className="text-destructive text-sm" role="alert">
						{imageError}
					</p>
				)}

				<div
					className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${
						isDragging
							? "border-dashed border-primary bg-primary/5"
							: imagePreview
								? "border-border bg-background hover:border-primary/50"
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
					{imagePreview ? (
						<div className="relative aspect-4/3 w-full">
							<img
								src={imagePreview}
								alt="Vista previa"
								className="h-full w-full object-contain p-4"
							/>

							{imageFile && (
								<div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1">
									<span className="text-white text-xs">{imageFile.name}</span>
								</div>
							)}

							{!isSubmitting && (
								<div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-all duration-200 group-hover:bg-black/40 opacity-0 group-hover:opacity-100">
									<Button
										type="button"
										variant="secondary"
										size="sm"
										onClick={(e) => {
											e.stopPropagation();
											fileInputRef.current?.click();
										}}
										className="bg-white text-zinc-900 shadow-sm hover:bg-white/80"
									>
										<HugeiconsIcon icon={Upload01Icon} className="size-3.5" />
										Cambiar
									</Button>
									<Button
										type="button"
										variant="destructive"
										size="sm"
										onClick={(e) => {
											e.stopPropagation();
											handleRemoveImage();
										}}
										className="border-0 text-white shadow-sm"
									>
										<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
										Eliminar
									</Button>
								</div>
							)}
						</div>
					) : (
						<div
							role="button"
							tabIndex={0}
							className="flex aspect-4/3 w-full cursor-pointer flex-col items-center justify-center gap-4 p-8 text-center"
							onClick={() => !isSubmitting && fileInputRef.current?.click()}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									fileInputRef.current?.click();
								}
							}}
						>
							<div className="rounded-full bg-primary/10 p-4">
								<HugeiconsIcon icon={CloudUploadIcon} className="size-8 text-primary" />
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium text-foreground">
									Arrastra una imagen o haz clic para seleccionar
								</p>
								<p className="text-muted-foreground/60 text-xs">
									PNG, JPG o WEBP. Máximo {CATEGORY_IMAGE_MAX_BYTES / (1024 * 1024)} MB.
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
								Seleccionar
							</Button>
						</div>
					)}
				</div>
			</Field>

			<Separator />

			{/* ── SEO ── */}
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
						const errorMessageId = getFieldErrorId(CATEGORY_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Título SEO</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Laptops, notebooks y ultrabooks — tienda de informática"
									maxLength={CATEGORY_SEO_TITLE_MAX}
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
						const errorMessageId = getFieldErrorId(CATEGORY_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Descripción SEO</FieldLabel>
								<Textarea
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Encuentra las mejores laptops, notebooks y ultrabooks..."
									rows={2}
									maxLength={CATEGORY_SEO_DESCRIPTION_MAX}
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
						const errorMessageId = getFieldErrorId(CATEGORY_FORM_ID, field.name);

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Palabras clave (SEO)</FieldLabel>
								<FieldDescription>
									Separadas por coma. Ej: laptop, notebook, ultrabook
								</FieldDescription>
								<Textarea
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="laptops, notebooks, ultrabooks, PC portátiles"
									rows={2}
									maxLength={CATEGORY_SEO_KEYWORDS_MAX}
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

			<Separator />

			{/* ── Visibility toggles ── */}
			<header className="flex flex-col">
				<h3 className="font-medium text-foreground text-sm">Visibilidad</h3>
				<FieldDescription>Controla dónde y cómo se muestra esta categoría.</FieldDescription>
			</header>

			<div className="flex flex-col gap-5 rounded-lg border p-4">
				<form.Field name="isActive">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(CATEGORY_FORM_ID, field.name);

						return (
							<Field
								orientation="horizontal"
								className="items-center justify-between gap-4"
								data-invalid={isInvalid}
							>
								<div className="min-w-0 flex flex-col gap-1">
									<FieldLabel htmlFor={field.name} className="cursor-pointer">
										Categoría activa
									</FieldLabel>
									<FieldDescription>
										Las categorías inactivas no aparecen en la tienda. Las subcategorías también se
										desactivarán.
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

				<form.Field name="isFeatured">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(CATEGORY_FORM_ID, field.name);

						return (
							<Field
								orientation="horizontal"
								className="items-center justify-between gap-4"
								data-invalid={isInvalid}
							>
								<div className="min-w-0 flex flex-col gap-1">
									<FieldLabel htmlFor={field.name} className="cursor-pointer">
										Categoría destacada
									</FieldLabel>
									<FieldDescription>
										Aparece en la sección de categorías destacadas.
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

				<form.Field name="isVisibleInNav">
					{(field) => {
						const wasSubmitted = field.form.state.submissionAttempts > 0;
						const isInvalid =
							(field.state.meta.isTouched || wasSubmitted) && field.state.meta.errors.length > 0;
						const errorMessageId = getFieldErrorId(CATEGORY_FORM_ID, field.name);

						return (
							<Field
								orientation="horizontal"
								className="items-center justify-between gap-4"
								data-invalid={isInvalid}
							>
								<div className="min-w-0 flex flex-col gap-1">
									<FieldLabel htmlFor={field.name} className="cursor-pointer">
										Visible en navegación
									</FieldLabel>
									<FieldDescription>
										Controla si aparece en el menú de navegación de la tienda.
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
		</form>
	);
}
