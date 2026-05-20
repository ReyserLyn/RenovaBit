import { S3Client } from "@aws-sdk/client-s3";

/**
 * R2 S3Client — Single Source of Truth.
 *
 * Cloudflare R2 implementa la API de S3. Usamos el SDK de AWS
 * con endpoint de R2 y region='auto'.
 *
 * Nunca instancies otro S3Client. Este es el único lugar donde
 * se configuran las credenciales de R2.
 */
export const r2Client = new S3Client({
	region: "auto",
	endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID!,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
	},
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
