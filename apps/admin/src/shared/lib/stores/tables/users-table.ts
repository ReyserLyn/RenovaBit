import { createTableStore } from "../table-store";

export const useUsersTableStore = createTableStore("users", {
	columnVisibility: { username: false, updatedAt: false },
	sorting: [{ id: "createdAt", desc: true }],
});
