import { Blueprint } from "@pickup-bball/ui/components/blueprint";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import SectionKicker from "@/components/section-kicker";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const { session } = Route.useRouteContext();
	const privateData = useQuery(orpc.privateData.queryOptions());

	return (
		<section className="pt-18 pb-15">
			<h1 className="-ml-[0.05em] font-heading text-[clamp(40px,6vw,80px)] uppercase leading-[1.02] tracking-[0.01em]">
				<span className="block">Welcome, {session?.user.name}.</span>
				<span className="block text-steel-700">You're on the list.</span>
			</h1>
			<div className="mt-10">
				<SectionKicker className="mb-5">05 · Your account</SectionKicker>
			</div>
			<Blueprint className="max-w-[480px] p-6">
				<dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px] leading-6">
					<dt className="kicker text-steel-700">Name</dt>
					<dd className="m-0">{session?.user.name}</dd>
					<dt className="kicker text-steel-700">Email</dt>
					<dd className="m-0">{session?.user.email}</dd>
					<dt className="kicker text-steel-700">API</dt>
					<dd className="m-0 text-neutral-700">
						{privateData.isLoading
							? "Checking..."
							: (privateData.data?.message ?? "Unavailable")}
					</dd>
				</dl>
			</Blueprint>
		</section>
	);
}
