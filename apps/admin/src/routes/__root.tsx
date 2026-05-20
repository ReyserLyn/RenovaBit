import { Toaster } from "@renovabit/ui/components/ui/sonner";
import appCss from "@renovabit/ui/styles/globals.css?url";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { ThemeProvider } from "better-themes";
import TanStackFormDevtools from "@/shared/integrations/tanstack-form/devtools";
import TanStackQueryDevtools from "@/shared/integrations/tanstack-query/devtools";
import TanStackQueryProvider from "@/shared/integrations/tanstack-query/root-provider";
import TanStackRouterDevtools from "@/shared/integrations/tanstack-router/devtools";

export type MyRouterContext = {
	queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Renovabit · Panel tienda" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{
				rel: "icon",
				href: "/favicon.ico",
				type: "image/x-icon",
			},
		],
	}),

	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="es" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<ThemeProvider attribute="class" disableTransitionOnChange>
					<TanStackQueryProvider>
						<Toaster richColors />
						{children}
						{import.meta.env.DEV && (
							<TanStackDevtools
								config={{ position: "bottom-right" }}
								plugins={[TanStackRouterDevtools, TanStackQueryDevtools, TanStackFormDevtools]}
							/>
						)}
					</TanStackQueryProvider>
				</ThemeProvider>
				<Scripts />
			</body>
		</html>
	);
}
