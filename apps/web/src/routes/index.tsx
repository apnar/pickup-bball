import { createFileRoute } from "@tanstack/react-router";

import MarketingHome from "@/components/marketing-home";
import PlayerHome from "@/components/player-home";
import { nextHeadcountOptions } from "@/hooks/use-rsvps";

export const Route = createFileRoute("/")({
	component: HomeComponent,
	// Strangers get no headcount, so there is nothing to prefetch for them.
	loader: ({ context }) =>
		context.session
			? context.queryClient.ensureQueryData(nextHeadcountOptions())
			: null,
});

function HomeComponent() {
	const { session } = Route.useRouteContext();
	return session ? <PlayerHome /> : <MarketingHome />;
}
