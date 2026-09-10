import { Blueprint, Corners } from "@pickup-bball/ui/components/blueprint";
import { Button, buttonVariants } from "@pickup-bball/ui/components/button";
import { Input } from "@pickup-bball/ui/components/input";
import { Link, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";

import { GameFacts } from "@/components/game-facts";
import { ResponsePicker } from "@/components/response-picker";
import { RsvpStatus } from "@/components/rsvp-status";
import SectionKicker from "@/components/section-kicker";
import { useRsvps } from "@/hooks/use-rsvps";
import { type RsvpAnswer, yourLine } from "@/lib/rsvp";

const CARD: Record<RsvpAnswer, string> = {
	in: "bg-steel text-ground",
	maybe: "hatch bg-steel-100 text-steel-800",
	out: "bg-transparent text-neutral-600",
};

export default function RsvpBoard() {
	const {
		headcount,
		isPending,
		add,
		respond,
		setResponse,
		comeBack,
		backPending,
	} = useRsvps();
	const { session } = useRouteContext({ from: "__root__" });
	const [draft, setDraft] = useState("");

	if (!headcount) {
		return (
			<section id="rsvp" className="scroll-mt-6 py-12 pb-15">
				<SectionKicker className="mb-6">02 · Next game</SectionKicker>
				<Blueprint className="max-w-[560px] p-6">
					<p className="m-0 font-heading font-semibold text-2xl uppercase leading-7 tracking-[0.02em]">
						No gym booked yet.
					</p>
					<p className="mt-3 mb-4 text-[15px] text-neutral-700 leading-6">
						When a permit lands, the emails start the evening before and the
						headcount opens here. Until then there is nothing to be in for.
					</p>
					<Link
						to="/schedule"
						className={buttonVariants({
							variant: "outline",
							size: "sm",
							className: "no-underline",
						})}
					>
						See the schedule
					</Link>
				</Blueprint>
			</section>
		);
	}

	const { game, me, viewer, rsvps } = headcount;
	const away = viewer?.status === "suspended";
	// Once the verdict is in, the sheet is a record rather than a question.
	const locked = game.status === "canceled" || Boolean(game.decidedAt);
	const mine = me ? (rsvps.find((r) => r.id === me)?.response ?? null) : null;

	return (
		<section id="rsvp" className="scroll-mt-6 py-12 pb-15">
			<SectionKicker className="mb-6">
				02 · Next game · {game.dateLabel}
			</SectionKicker>
			<GameFacts game={game} />

			<div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-x-[clamp(24px,5vw,96px)]">
				<div>
					<RsvpStatus headcount={headcount} />

					<div className="mt-8 max-w-[480px]">
						{away ? (
							// No spot while they are out, but coming back is one tap --
							// the button they want is the one that undoes the break.
							<div className="border border-amber-300 bg-amber-50 px-4 py-3">
								<p className="m-0 text-[13px] text-amber-900 leading-5">
									You're taking a break
									{viewer?.reason ? `: ${viewer.reason}` : ""}
									{viewer?.suspendedUntil
										? `, until ${new Date(
												viewer.suspendedUntil,
											).toLocaleDateString("en-US", {
												month: "long",
												day: "numeric",
												timeZone: "America/New_York",
											})}`
										: ""}
									. You're not on the sheet.
								</p>
								<Button
									className="mt-3"
									size="sm"
									disabled={backPending}
									onClick={() => comeBack()}
								>
									I'm back
								</Button>
							</div>
						) : (
							<>
								<ResponsePicker
									name="my-response"
									legend={`Your answer, ${session?.user.name}`}
									value={mine}
									disabled={isPending || locked}
									onPick={(answer) => respond(answer)}
								/>
								<p className="mt-2 text-[13px] text-neutral-700 leading-5">
									{yourLine(mine, locked)}
								</p>
							</>
						)}
					</div>

					{locked ? null : (
						<form
							className="mt-6 flex max-w-[480px] gap-2.5"
							onSubmit={async (e) => {
								e.preventDefault();
								if (!draft.trim()) return;
								try {
									await add(draft);
									setDraft("");
								} catch {
									// The toast already said so.
								}
							}}
						>
							<Input
								aria-label="Add a friend"
								placeholder="Add a friend"
								maxLength={40}
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
							/>
							<Button type="submit" variant="outline" disabled={isPending}>
								Add
							</Button>
						</form>
					)}
					<p className="mt-4 max-w-[52ch] text-[13px] text-neutral-700 leading-5">
						You answer for yourself and for anyone you drag along. Everybody
						else answers for themselves, which is new, and better.
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
							<fieldset
								key={r.id}
								disabled={isPending || locked || !r.mine}
								className={`blueprint m-0 min-w-0 p-0 ${CARD[r.response]}`}
							>
								<Corners />
								<legend className="sr-only">
									{r.name}
									{r.id === me ? " (you)" : ""}
								</legend>
								<div className="px-4 pt-3.5 pb-2">
									<span
										aria-hidden="true"
										className="font-heading font-semibold text-xl uppercase leading-[22px] tracking-[0.02em]"
									>
										{r.name}
									</span>
									{r.id === me ? (
										<span
											aria-hidden="true"
											className="kicker ml-2 text-[11px] opacity-70"
										>
											you
										</span>
									) : null}
								</div>
								<ResponsePicker
									size="small"
									name={`rsvp-${r.id}`}
									legend={r.name}
									value={r.response}
									disabled={isPending || locked || !r.mine}
									onPick={(answer) => setResponse(r.id, answer)}
								/>
							</fieldset>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
