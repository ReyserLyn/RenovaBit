import { generatePresignUrl } from "@/utils/storage/helpers";
import type { StorageModel } from "./model";

type CreateBody = StorageModel["presignRequest"];

export async function createPresignedUrl(data: CreateBody) {
	return generatePresignUrl(data.filename, data.contentType);
}
