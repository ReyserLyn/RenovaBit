/**
 * Local image generator for placeholders and social assets (Gemini image API).
 *
 * Purpose:
 *   Generate LOCAL placeholder / social images for development and previews.
 *   This is a dev utility: it is not part of any build or runtime path.
 *
 * Usage (from the repo root):
 *   bun run gen:image -- apps/tienda/scripts/jobs/placeholder.json [--out <dir>] [--model lite|nb2|pro]
 *
 *   Or directly (if you run it from elsewhere):
 *   bun --env-file=.env apps/tienda/scripts/gen-image.ts <jobs.json> [--out <dir>] [--model lite|nb2|pro]
 *
 * API key:
 *   Read from `GEMINI_API_KEY`, which lives in the gitignored root `.env`.
 *   Never commit it or print its value.
 *
 * Jobs JSON: an array of jobs:
 *   [
 *     {
 *       "name": "placeholder-light",  // required; output base name (slugified, .png appended)
 *       "prompt": "Minimalist ...",   // required
 *       "aspectRatio": "1:1",         // optional; defaults to "1:1"
 *       "model": "lite",              // optional per-job override of --model: lite | nb2 | pro
 *       "imageSize": "1K",            // optional; defaults to "1K"
 *       "ref": "path/to/image.png"    // optional local reference image (edit mode), png/jpg/jpeg/webp
 *     }
 *   ]
 *
 * Output:
 *   Defaults to apps/tienda/.raw/gen-image, resolved from this script (not the cwd).
 *   `.raw/` is gitignored: generated images are local working files and must NOT be
 *   committed unless you explicitly decide to promote one.
 *
 * Estimated cost per 1K image (official API pricing, Sep 2026):
 *   lite $0.0336 | nb2 $0.067 | pro $0.134
 *   The summary below assumes 1K, the default size used by the bundled jobs.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const MODELS = {
	lite: "gemini-3.1-flash-lite-image",
	nb2: "gemini-3.1-flash-image",
	pro: "gemini-3-pro-image",
} as const;
type Model = keyof typeof MODELS;

/** Estimated USD cost per 1K image (official API pricing, Sep 2026). */
const COST_1K: Record<Model, number> = { lite: 0.0336, nb2: 0.067, pro: 0.134 };

const MIME: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
};

/** Default output dir, resolved from this script so it does not depend on the cwd. */
const DEFAULT_OUT = join(import.meta.dir, "..", ".raw", "gen-image");

interface Job {
	name: string;
	prompt: string;
	aspectRatio?: string;
	model?: Model;
	imageSize?: string;
	/** Local reference image (edit mode), resolved from the cwd. */
	ref?: string;
}

function isModel(value: string): value is Model {
	return value in MODELS;
}

/**
 * Restrict output names to [a-z0-9-]. This is what keeps a job from escaping the
 * output directory via path traversal (`../`, absolute paths, dots, separators).
 */
function slugify(value: string): string {
	const slug = value
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "image";
}

function readArgs(argv: string[]) {
	const jobsPath = argv[0];
	let out = DEFAULT_OUT;
	let model = "lite";
	for (let i = 1; i < argv.length; i++) {
		if (argv[i] === "--out" && argv[i + 1]) out = argv[++i] as string;
		else if (argv[i] === "--model" && argv[i + 1]) model = argv[++i] as string;
	}
	return { jobsPath, out, model };
}

async function generate(job: Job, globalModel: Model, apiKey: string, outDir: string) {
	if (!job.name || !job.prompt) throw new Error("each job needs a name and a prompt");
	const model = job.model ?? globalModel;
	if (!isModel(model)) throw new Error(`unknown model: ${model}`);

	const parts: Record<string, unknown>[] = [];
	if (job.ref) {
		const mime = MIME[extname(job.ref).toLowerCase()];
		if (!mime) throw new Error(`unsupported reference format: ${job.ref}`);
		const data = (await readFile(job.ref)).toString("base64");
		parts.push({ inlineData: { mimeType: mime, data } });
	}
	parts.push({ text: job.prompt });

	const body = {
		contents: [{ parts }],
		generationConfig: {
			responseModalities: ["IMAGE"],
			imageConfig: {
				aspectRatio: job.aspectRatio ?? "1:1",
				imageSize: job.imageSize ?? "1K",
			},
		},
	};

	const startedAt = Date.now();
	const res = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${MODELS[model]}:generateContent`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
			body: JSON.stringify(body),
		},
	);
	if (!res.ok) {
		throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
	}
	const data = (await res.json()) as {
		candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
	};
	const b64 = data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)
		?.inlineData?.data;
	if (!b64) throw new Error(`no image in response: ${JSON.stringify(data).slice(0, 200)}`);

	await mkdir(outDir, { recursive: true });
	const filePath = join(outDir, `${slugify(job.name)}.png`);
	await writeFile(filePath, Buffer.from(b64, "base64"));
	return { filePath, seconds: ((Date.now() - startedAt) / 1000).toFixed(1), cost: COST_1K[model] };
}

const { jobsPath, out, model: modelFlag } = readArgs(process.argv.slice(2));
if (!jobsPath) {
	console.error(
		"Usage: bun run gen:image -- <jobs.json> [--out <dir>] [--model lite|nb2|pro] (from the repo root)",
	);
	process.exit(1);
}
if (!isModel(modelFlag)) {
	console.error(`Unknown model: ${modelFlag}. Use lite | nb2 | pro.`);
	process.exit(1);
}
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
	console.error(
		"Missing GEMINI_API_KEY in the environment (expected in the gitignored root .env).",
	);
	process.exit(1);
}

const jobs = JSON.parse(await readFile(jobsPath, "utf8")) as Job[];
if (!Array.isArray(jobs)) {
	console.error("The jobs JSON must be an array of jobs.");
	process.exit(1);
}

let total = 0;
let ok = 0;
let failed = 0;
for (const job of jobs) {
	try {
		const result = await generate(job, modelFlag, apiKey, out);
		ok += 1;
		total += result.cost;
		console.log(
			`OK ${job.name} -> ${result.filePath} | ${result.seconds}s | $${result.cost.toFixed(4)}`,
		);
	} catch (error) {
		failed += 1;
		console.error(`ERROR ${job.name}: ${error instanceof Error ? error.message : error}`);
	}
}
console.log(`Done: ${ok}/${jobs.length} | estimated cost: $${total.toFixed(4)}`);
if (failed > 0) {
	process.exitCode = 1;
}
