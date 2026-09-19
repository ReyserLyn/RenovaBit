import { describe, expect, it } from "bun:test";
import { getUserDisplayName, getUserInitials } from "../lib/user-helpers";
import type { UserInfo } from "../model";

const base: UserInfo = {
	id: "user-1",
	email: "user@example.com",
	username: null,
	displayUsername: null,
};

describe("getUserDisplayName", () => {
	it("returns a dash for a missing user", () => {
		expect(getUserDisplayName(null)).toBe("—");
	});

	it("prefers displayUsername, then username, then email, then id", () => {
		expect(getUserDisplayName({ ...base, displayUsername: "Ada" })).toBe("Ada");
		expect(getUserDisplayName({ ...base, username: "ada" })).toBe("ada");
		expect(getUserDisplayName(base)).toBe("user@example.com");
		expect(getUserDisplayName({ ...base, email: "" })).toBe("user-1");
	});
});

describe("getUserInitials", () => {
	it("returns a question mark for a missing user", () => {
		expect(getUserInitials(null)).toBe("?");
	});

	it("uppercases the first two characters of the preferred name", () => {
		expect(getUserInitials({ ...base, displayUsername: "ada lovelace" })).toBe("AD");
		expect(getUserInitials({ ...base, username: "bob" })).toBe("BO");
	});

	it("returns a question mark when the user has no usable name", () => {
		expect(getUserInitials({ ...base, email: "" })).toBe("?");
	});
});
