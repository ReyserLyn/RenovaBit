import { createTableStore } from "../table-store";

export const useOrdersTableStore = createTableStore("orders", {
	columnVisibility: { source: false },
	sorting: [{ id: "createdAt", desc: true }],
});
