import { Blueprint, Corners } from "@pickup-bball/ui/components/blueprint";
import { Button, buttonVariants } from "@pickup-bball/ui/components/button";
import { Input } from "@pickup-bball/ui/components/input";
import { Link, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";

import SectionKicker from "@/components/section-kicker";
import { useRsvps } from "@/hooks/use-rsvps";

function headline(inCount: number, open: number) {
	if (open <= 0) return "Run is full. Someone is sitting.";
	if (inCount >= 8) return "We have a game. Barely.";
	if (inCount >= 5) return "Half court unless three more grow up.";
	return "This is a shooting session, not a run.";
}

function subline(inCount: number, open: number) {
	if (open <= 0) {
		return "First to the gym plays. Last to the gym referees, badly.";
	}
	const spots = `${open} spot${open === 1 ? "" : "s"} left.`;
	return inCount < 10
		? `${spots} Text the guys who "might come." They are not coming.`
		: spots;
}

export default function RsvpBoard() {
	const { headcount, isPending, add, addMe, toggle } = useRsvps();
	const { session } = useRouteContext({ from: "__root__" });
	const [draft, setDraft] = useState("");

	if (!headcount) {
		return (
			<section id="rsvp" className="scroll-mt-6 py-12 pb-15">
				<SectionKicker>02 · Next game</SectionKicker>
				<Blueprint className="flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center">
					<h2 className="font-heading text-[32px] uppercase leading-9 tracking-[0.02em]">
						No gym booked yet.
					</h2>
					<p className="max-w-[48ch] text-[15px] text-neutral-700 leading-6">
						When a permit lands, the headcount opens here. Until then, the group
						chat is the gym.
					</p>
					<Link
						to="/schedule"
						className={buttonVariants({
							variant: "ghost",
							className: "no-underline",
						})}
					>
						See the schedule
					</Link>
				</Blueprint>
			</section>
		);
	}

	const { game, capacity, me, rsvps } = headcount;
	const inCount = rsvps.filter((r) => r.isIn).length;
	const open = capacity - inCount;
	const fillPct = Math.min(100, Math.round((inCount / capacity) * 100));

	return (
		<section id="rsvp" className="scroll-mt-6 py-12 pb-15">
			<SectionKicker className="mb-6">
				02 · Next game · {game.dateLabel}
			</SectionKicker>
			<div className="mb-8 flex flex-wrap items-center gap-x-8 gap-y-3">
				<span className="font-heading font-semibold text-[32px] uppercase leading-9 tracking-[0.02em]">
					{game.dateLabel}
				</span>
				<span className="font-heading font-semibold text-[22px] leading-6 tracking-[0.02em]">
					{game.timeLabel}
				</span>
				<span className="text-[15px] text-neutral-700 leading-6">
					{game.location}
				</span>
				{game.permit ? (
					<a
						href={`/api/permits/${game.permit.id}/file`}
						target="_blank"
						rel="noreferrer"
						className={buttonVariants({
							variant: "outline",
							size: "sm",
							className: "no-underline",
						})}
					>
						Permit (PDF)
					</a>
				) : (
					<span className="kicker text-neutral-600">No permit attached</span>
				)}
			</div>
			{game.notes ? (
				<p className="-mt-4 mb-8 max-w-[60ch] text-[15px] text-neutral-700 leading-6">
					{game.notes}
				</p>
			) : null}
			<div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-x-[clamp(24px,5vw,96px)]">
				<div>
					<h2 className="font-heading text-[32px] uppercase leading-9 tracking-[0.02em]">
						{headline(inCount, open)}
					</h2>
					<p className="mt-4 max-w-[48ch] text-[15px] text-neutral-700 leading-6">
						{subline(inCount, open)}
					</p>
					<div className="kicker tnum mt-6 mb-2 flex justify-between">
						<span>{inCount} in</span>
						<span className="text-neutral-700">{capacity} spots</span>
					</div>
					<div className="relative h-2 border border-divider">
						<div
							className="absolute inset-0 bg-steel transition-[width]"
							style={{ width: `${fillPct}%` }}
						/>
					</div>
					<div className="mt-6 max-w-[480px]">
						<Button disabled={isPending || Boolean(me)} onClick={() => addMe()}>
							{me
								? `You're in, ${session?.user.name}.`
								: `I'm in as ${session?.user.name}`}
						</Button>
					</div>
					<form
						className="mt-4 flex max-w-[480px] gap-2.5"
						onSubmit={async (e) => {
							e.preventDefault();
							if (!draft.trim()) return;
							try {
								await add(draft);
								setDraft("");
							} catch {
								// The mutation already surfaced the error as a toast.
							}
						}}
					>
						<Input
							type="text"
							placeholder="Add a friend"
							aria-label="Add a friend"
							value={draft}
							maxLength={40}
							onChange={(e) => setDraft(e.target.value)}
							className="flex-1"
						/>
						<Button type="submit" variant="outline" disabled={isPending}>
							Add
						</Button>
					</form>
					<p className="mt-2 text-[13px] text-neutral-700 leading-5">
						Tap a name to flip it. Flipping to Out the day of the game is public
						record.
					</p>
				</div>
				{rsvps.length === 0 ? (
					<div className="blueprint flex min-h-32 items-center justify-center p-6 text-center text-[15px] text-neutral-700 leading-6">
						<Corners />
						<span>
							Nobody is on the sheet yet.
							<br />
							Be the first name in and start the shaming.
						</span>
					</div>
				) : (
					<div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5 p-2">
						{rsvps.map((r) => (
							<button
								key={r.id}
								type="button"
								onClick={() => toggle(r.id)}
								aria-pressed={r.isIn}
								disabled={isPending}
								className={`blueprint flex min-h-16 cursor-pointer flex-col gap-1 px-4 py-3.5 text-left transition-colors disabled:cursor-wait ${
									r.isIn
										? "bg-steel text-ground hover:bg-steel-600"
										: "bg-transparent text-ink hover:bg-ink/5"
								}`}
							>
								<Corners />
								<span className="font-heading font-semibold text-xl uppercase leading-[22px] tracking-[0.02em]">
									{r.name}
								</span>
								<span className="font-semibold text-xs uppercase tracking-[0.08em] opacity-85">
									{r.isIn ? "In" : "Out · excuse pending"}
									{r.id === me ? " · you" : ""}
								</span>
							</button>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
