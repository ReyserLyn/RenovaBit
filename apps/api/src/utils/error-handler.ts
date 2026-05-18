import { ApiError, BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { getLogger } from "./logger";

// biome-ignore lint/suspicious/noExplicitAny: Elysia error handler context type is complex
export function errorHandler(ctx: any) {
	const { error, set, code, request } = ctx;
	const log = getLogger();
	const method = request?.method;
	const url = request?.url;

	if (code === "NOT_FOUND") {
		set.status = 404;
		log.withMetadata({ method, url }).warn("Route not found");
		return {
			errId: "route-not-found",
			code: "NOT_FOUND",
			message: `Route not found: ${method} ${url}`,
			statusCode: 404,
		};
	}

	if (error instanceof ApiError) {
		if (!error.doNotLog) {
			const level = error.logLevel ?? (error.statusCode >= 500 ? "error" : "warn");
			const msg = `${error.code} — ${error.message}`;
			const logMeta = log.withMetadata({ errId: error.errId, method, url });

			switch (level) {
				case "warn":
					logMeta.warn(msg);
					break;
				case "info":
					logMeta.info(msg);
					break;
				case "debug":
					logMeta.debug(msg);
					break;
				case "trace":
					logMeta.trace(msg);
					break;
				default:
					logMeta.error(msg);
			}
		}

		if (error.isInternalError) {
			const e = createApiError({
				code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
				causedBy: error,
				...(error.validationError ? { validationError: error.validationError } : {}),
			});
			e.errId = error.errId;
			set.status = e.statusCode;
			return e.toJSONSafe();
		}

		set.status = error.statusCode;
		return error.toJSONSafe();
	}

	if (code === "VALIDATION") {
		const e = createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			validationError: {
				validation: error?.all ?? [],
				validationContext: "body",
				message: error?.message ?? "Validation error",
			},
			causedBy: error,
		});
		set.status = e.statusCode;
		return e.toJSONSafe();
	}

	const e = createApiError({
		code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
		message: "An internal server error occurred",
		causedBy: error,
	});

	log.withMetadata({ errId: e.errId, method, url }).error(error.message);

	set.status = 500;
	return e.toJSONSafe();
}
