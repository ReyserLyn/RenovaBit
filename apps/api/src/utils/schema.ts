import { t } from "elysia";

export const ImageFileSchema = t.File({
	type: "image/*",
	maxSize: "5m",
});

export const ImageFilesSchema = t.Files({
	type: "image/*",
	maxSize: "5m",
	minItems: 1,
	maxItems: 5,
});
