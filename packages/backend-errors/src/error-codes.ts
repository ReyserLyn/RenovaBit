export enum BackendErrorCodes {
	ACCESS_DENIED = "ACCESS_DENIED",
	BAD_REQUEST = "BAD_REQUEST",
	CONFLICT = "CONFLICT",
	EXISTS_ERROR = "EXISTS_ERROR",
	INPUT_VALIDATION_ERROR = "INPUT_VALIDATION_ERROR",
	INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
	INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
	NOT_FOUND_ERROR = "NOT_FOUND_ERROR",
	RATE_LIMITED = "RATE_LIMITED",
	SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
	UNPROCESSABLE_ENTITY = "UNPROCESSABLE_ENTITY",
}

export const BackendErrorCodeDefs = {
	[BackendErrorCodes.ACCESS_DENIED]: {
		message: "Access denied",
		statusCode: 403,
	},
	[BackendErrorCodes.BAD_REQUEST]: {
		message: "Bad request",
		statusCode: 400,
	},
	[BackendErrorCodes.CONFLICT]: {
		message: "Resource conflict",
		statusCode: 409,
	},
	[BackendErrorCodes.EXISTS_ERROR]: {
		message: "Resource already exists",
		statusCode: 409,
	},
	[BackendErrorCodes.INPUT_VALIDATION_ERROR]: {
		message: "Invalid input",
		statusCode: 400,
	},
	[BackendErrorCodes.INTERNAL_SERVER_ERROR]: {
		message: "Internal server error",
		statusCode: 500,
	},
	[BackendErrorCodes.INVALID_CREDENTIALS]: {
		message: "Invalid credentials",
		statusCode: 401,
	},
	[BackendErrorCodes.NOT_FOUND_ERROR]: {
		message: "Resource not found",
		statusCode: 404,
	},
	[BackendErrorCodes.RATE_LIMITED]: {
		message: "Too many requests",
		statusCode: 429,
	},
	[BackendErrorCodes.SERVICE_UNAVAILABLE]: {
		message: "Service temporarily unavailable",
		statusCode: 503,
	},
	[BackendErrorCodes.UNPROCESSABLE_ENTITY]: {
		message: "Unprocessable entity",
		statusCode: 422,
	},
};
