import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function getContext() {
	const queryClient = new QueryClient();

	return {
		queryClient,
	};
}

export default function TanstackQueryProvider({ children }: { children: ReactNode }) {
	return children;
}
