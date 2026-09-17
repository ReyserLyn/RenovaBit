import { describe, expect, test } from "bun:test";
import {
	ApiClientError,
	type ApiErrorResponse,
	extractApiError,
	isApiClientError,
	unwrapResponse,
} from "../api-errors";

const makeErrorResponse = (overrides: Partial<ApiErrorResponse> = {}): ApiErrorResponse => ({
	errId: "err_123",
	code: "BAD_REQUEST",
	message: "Something went wrong",
	statusCode: 400,
	...overrides,
});

describe("ApiClientError", () => {
	test("creates an error with the response shape", () => {
		const response = makeErrorResponse();
		const error = new ApiClientError(response);

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("ApiClientError");
		expect(error.message).toBe("Something went wrong");
		expect(error.errId).toBe("err_123");
		expect(error.code).toBe("BAD_REQUEST");
		expect(error.statusCode).toBe(400);
	});

	test("carries optional metadata", () => {
		const response = makeErrorResponse({ metadata: { foo: "bar" } });
		const error = new ApiClientError(response);

		expect(error.metadata).toEqual({ foo: "bar" });
	});

	test("carries optional validationError", () => {
		const response = makeErrorResponse({
			validationError: {
				validation: [{ message: "Field is required", path: "email" }],
				validationContext: "body",
				message: "Validation failed",
			},
		});
		const error = new ApiClientError(response);

		expect(error.validationError).toBeDefined();
		expect(error.validationError?.validation[0]?.path).toBe("email");
	});
});

describe("isApiClientError", () => {
	test("returns true for ApiClientError instances", () => {
		const error = new ApiClientError(makeErrorResponse());
		expect(isApiClientError(error)).toBe(true);
	});

	test("returns false for regular Error", () => {
		expect(isApiClientError(new Error("nope"))).toBe(false);
	});

	test("returns false for null", () => {
		expect(isApiClientError(null)).toBe(false);
	});

	test("returns false for a plain object", () => {
		expect(isApiClientError({ message: "nope" })).toBe(false);
	});
});

describe("extractApiError", () => {
	test("extracts from an Eden Treaty error shape (value property)", () => {
		const treatyError = {
			value: makeErrorResponse({ code: "NOT_FOUND_ERROR" }),
		};
		const result = extractApiError(treatyError);

		expect(result).toBeInstanceOf(ApiClientError);
		expect(result?.code).toBe("NOT_FOUND_ERROR");
		expect(result?.message).toBe("Something went wrong");
		expect(result?.errId).toBe("err_123");
	});

	test("returns null for a non-object", () => {
		expect(extractApiError("string")).toBeNull();
	});

	test("returns null for an object without value property", () => {
		expect(extractApiError({})).toBeNull();
	});

	test("returns null for an object where value is missing required fields", () => {
		expect(extractApiError({ value: { errId: "1" } })).toBeNull();
	});
});

describe("unwrapResponse", () => {
	test("returns data on 2xx-style response", async () => {
		const result = await unwrapResponse(Promise.resolve({ data: { id: 1 }, error: null }));
		expect(result).toEqual({ id: 1 });
	});

	test("throws ApiClientError on Eden Treaty error", async () => {
		const response = makeErrorResponse({ code: "BAD_REQUEST" });
		const promise = Promise.resolve({ data: null, error: { value: response } });

		await expect(unwrapResponse(promise)).rejects.toThrow(ApiClientError);
		await expect(unwrapResponse(promise)).rejects.toMatchObject({
			code: "BAD_REQUEST",
			statusCode: 400,
		});
	});

	test("throws generic Error when data is null and no error", async () => {
		await expect(unwrapResponse(Promise.resolve({ data: null, error: null }))).rejects.toThrow(
			"Unexpected null response from API",
		);
	});

	test("throws original Error when error is an Error instance", async () => {
		await expect(
			unwrapResponse(Promise.resolve({ data: null, error: new Error("network failure") })),
		).rejects.toThrow("network failure");
	});

	test("wraps non-Error error in generic Error", async () => {
		await expect(
			unwrapResponse(Promise.resolve({ data: null, error: "raw string" })),
		).rejects.toThrow("raw string");
	});
});
