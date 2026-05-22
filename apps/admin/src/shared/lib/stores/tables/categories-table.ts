import { createTableStore } from "../table-store";

export const useCategoriesTableStore = createTableStore("categories", {
	columnVisibility: { createdAt: false, updatedAt: false },
	sorting: [{ id: "parent", desc: false }],
});
