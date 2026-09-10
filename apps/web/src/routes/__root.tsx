import { Toaster } from "@pickup-bball/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { SITE_NAME } from "@/content/run";
import { getUser } from "@/functions/get-user";
import type { orpc } from "@/utils/orpc";

import Header from "../components/header";

import appCss from "../index.css?url";
export interface RouterAppContext {
	orpc: typeof orpc;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	/**
	 * Every page needs to know whether it is talking to a player or a
	 * stranger, so the session is read once here and flows down as context.
	 * Runs on each client navigation: one server-function round trip, and no
	 * D1 read while the five-minute cookie cache holds.
	 */
	beforeLoad: async () => ({ session: await getUser() }),

	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: SITE_NAME,
			},
			{
				name: "description",
				content:
					"A weekly full-court run in Montgomery County. Show up or get talked about.",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	component: RootDocument,
});

function RootDocument() {
	const { session } = Route.useRouteContext();

	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<div className="flex min-h-svh flex-col">
					<Header />
					<div className="mx-auto w-full max-w-[1100px] flex-1 px-[clamp(20px,5vw,72px)]">
						<main>
							<Outlet />
						</main>
						<footer className="flex flex-wrap justify-between gap-2 border-divider border-t py-12 text-[13px] text-neutral-700 leading-6">
							<span>{SITE_NAME} · est. whenever Sean says</span>
							{session ? (
								<span>
									Rain, snow, or Sean's hip: the verdict is in your inbox by
									7:30.
								</span>
							) : (
								<span>
									Already on the list?{" "}
									<Link to="/login" className="text-steel-700">
										Sign in
									</Link>
									.
								</span>
							)}
						</footer>
					</div>
				</div>
				<Toaster richColors />
				<TanStackRouterDevtools position="bottom-left" />
				<ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
				<Scripts />
			</body>
		</html>
	);
}
