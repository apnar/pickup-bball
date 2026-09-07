import { createFileRoute } from "@tanstack/react-router";

import PageTitle from "@/components/page-title";
import SectionKicker from "@/components/section-kicker";
import { type RosterStatus, roster } from "@/content/run";

export const Route = createFileRoute("/roster")({
	component: RosterPage,
});

const tagClass: Record<RosterStatus, string> = {
	Founder: "bg-steel-100 text-steel-800",
	Regular: "bg-neutral-100 text-neutral-800",
	Probation: "border border-steel text-steel",
};

function RosterPage() {
	return (
		<section className="pt-18 pb-15">
			<PageTitle
				line1="The regulars."
				line2="Ranked by attendance, not talent."
			/>
			<p className="mt-7 mb-10 max-w-[60ch] text-base leading-6">
				Everyone here has shown up at least twenty Mondays. That is the only
				qualification. Height, handles and cardio were not considered.
			</p>
			<SectionKicker className="mb-5">03 · Personnel file</SectionKicker>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[640px] border-collapse text-sm">
					<thead>
						<tr>
							{[
								"No.",
								"Name",
								"Position",
								"Since",
								"Scouting report",
								"Status",
							].map((h) => (
								<th
									key={h}
									className="border-divider border-b px-2 py-1.5 text-left font-medium text-[11px] text-ink/60 uppercase tracking-[0.08em]"
								>
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{roster.map((p) => (
							<tr
								key={p.num}
								className="border-ink/8 border-b hover:bg-ink/4 [&>td]:px-2 [&>td]:py-1.5"
							>
								<td className="kicker tnum text-steel-700">{p.num}</td>
								<td className="whitespace-nowrap font-heading font-semibold text-xl uppercase tracking-[0.02em]">
									{p.name}
								</td>
								<td className="whitespace-nowrap">{p.pos}</td>
								<td className="tnum">{p.since}</td>
								<td className="text-neutral-700">{p.report}</td>
								<td>
									<span
										className={`inline-flex items-center px-2.5 py-[3px] text-[11px] tracking-[0.02em] ${tagClass[p.status]}`}
									>
										{p.status}
									</span>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p className="mt-4 text-[13px] text-neutral-700 leading-6">
				Want on the list? Show up twenty times. Bring both shirts. Don't ask
				Sean about the hip.
			</p>
		</section>
	);
}
