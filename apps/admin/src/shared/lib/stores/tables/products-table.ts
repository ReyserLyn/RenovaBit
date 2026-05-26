import { createTableStore } from "../table-store";

export const useProductsTableStore = createTableStore("products", {
	columnVisibility: { updatedAt: false, updatedBy: false },
	sorting: [{ id: "updatedAt", desc: true }],
});
