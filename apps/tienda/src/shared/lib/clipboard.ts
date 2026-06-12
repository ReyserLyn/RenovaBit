import { toast } from "sonner";

interface CopyTextOptions {
	label?: string;
	onSuccess?: () => void;
}

export async function copyText(text: string, options: CopyTextOptions = {}): Promise<boolean> {
	if (typeof navigator === "undefined" || !navigator.clipboard) {
		toast.error("Tu navegador no permite copiar al portapapeles");
		return false;
	}

	try {
		await navigator.clipboard.writeText(text);
		toast.success(options.label ? `${options.label} copiado` : "Copiado", { duration: 2000 });
		options.onSuccess?.();
		return true;
	} catch {
		toast.error("No se pudo copiar");
		return false;
	}
}
