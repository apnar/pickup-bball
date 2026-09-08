import { Blueprint } from "@pickup-bball/ui/components/blueprint";
import { Button } from "@pickup-bball/ui/components/button";
import { Input } from "@pickup-bball/ui/components/input";
import { Label } from "@pickup-bball/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import SectionKicker from "@/components/section-kicker";
import { orpc } from "@/utils/orpc";

/** Join the mailing list from the home page. */
export default function SubscribeForm() {
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [done, setDone] = useState(false);

	const subscribe = useMutation(
		orpc.subscribers.subscribe.mutationOptions({
			onSuccess: () => {
				setDone(true);
				toast.success("You're on the list. Leaving it is public record.");
			},
			onError: (error: Error) => toast.error(error.message),
		}),
	);

	return (
		<section id="subscribe" className="scroll-mt-6 py-12 pb-15">
			<SectionKicker className="mb-6">03 · Get the email</SectionKicker>
			<Blueprint className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
				<div>
					<h2 className="font-heading text-[32px] uppercase leading-9 tracking-[0.02em]">
						Hear about it before the group chat does.
					</h2>
					<p className="mt-4 max-w-[48ch] text-[15px] text-neutral-700 leading-6">
						One email when a gym is booked, one the morning of with who is in.
						Nothing else. Every email has an unsubscribe link, which Sean will
						take personally.
					</p>
				</div>
				{done ? (
					<p className="self-center text-base leading-6">
						Done. Check for a gym-booked email when the next permit lands.
					</p>
				) : (
					<form
						className="space-y-4 self-center"
						onSubmit={(e) => {
							e.preventDefault();
							subscribe.mutate({ email, name: name || undefined });
						}}
					>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
							<div className="space-y-1.5">
								<Label htmlFor="subscribe-email">Email</Label>
								<Input
									id="subscribe-email"
									type="email"
									required
									autoComplete="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="subscribe-name">Name (optional)</Label>
								<Input
									id="subscribe-name"
									maxLength={40}
									autoComplete="given-name"
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</div>
						</div>
						<Button type="submit" disabled={subscribe.isPending}>
							{subscribe.isPending ? "Adding..." : "Put me on the list"}
						</Button>
					</form>
				)}
			</Blueprint>
		</section>
	);
}
