import { createTableStore } from "../table-store";

export const useBrandsTableStore = createTableStore("brands", {
	columnVisibility: { updatedAt: false },
	sorting: [{ id: "updatedAt", desc: true }],
});
