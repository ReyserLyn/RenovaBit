import { createTableStore } from "../table-store";

export const useBlacklistTableStore = createTableStore("blacklist", {
	columnVisibility: { updatedAt: false },
	sorting: [{ id: "createdAt", desc: true }],
});
