import { Blueprint } from "@pickup-bball/ui/components/blueprint";
import { Button } from "@pickup-bball/ui/components/button";
import { Input } from "@pickup-bball/ui/components/input";
import { Label } from "@pickup-bball/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import SectionKicker from "@/components/section-kicker";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
	component: RouteComponent,
});

/**
 * Passwords are optional here. Most people get in from the links we email
 * them; a password is for anyone who would rather type one.
 */
function PasswordRow() {
	const queryClient = useQueryClient();
	const has = useQuery(orpc.account.hasPassword.queryOptions());
	const [open, setOpen] = useState(false);
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [busy, setBusy] = useState(false);

	const hasPassword = has.data?.hasPassword ?? false;

	const setPassword = useMutation(
		orpc.account.setPassword.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.account.key() });
				setOpen(false);
				setNext("");
				toast.success("Password set. The emailed links still work.");
			},
			onError: (error: Error) => toast.error(error.message),
		}),
	);

	const change = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		const result = await authClient.changePassword({
			currentPassword: current,
			newPassword: next,
		});
		setBusy(false);
		if (result.error) {
			toast.error(result.error.message || "That did not take.");
			return;
		}
		setOpen(false);
		setCurrent("");
		setNext("");
		toast.success("Changed.");
	};

	return (
		<>
			<dt className="kicker text-steel-700">Password</dt>
			<dd className="m-0 flex flex-wrap items-baseline gap-x-3">
				<span>
					{has.isLoading
						? "Checking..."
						: hasPassword
							? "Set. The emailed links work either way."
							: "None. The links in your email are how you get in."}
				</span>
				{has.isLoading ? null : (
					<Button variant="link" size="xs" onClick={() => setOpen((v) => !v)}>
						{open ? "Never mind" : hasPassword ? "Change it" : "Set one"}
					</Button>
				)}
			</dd>
			{open ? (
				<dd className="col-span-2 m-0">
					<form
						className="flex flex-wrap items-end gap-3"
						onSubmit={
							hasPassword
								? change
								: (e) => {
										e.preventDefault();
										setPassword.mutate({ newPassword: next });
									}
						}
					>
						{hasPassword ? (
							<div className="min-w-[180px] space-y-1.5">
								<Label htmlFor="current-password">Current</Label>
								<Input
									id="current-password"
									type="password"
									required
									autoComplete="current-password"
									value={current}
									onChange={(e) => setCurrent(e.target.value)}
								/>
							</div>
						) : null}
						<div className="min-w-[180px] space-y-1.5">
							<Label htmlFor="new-password">New password</Label>
							<Input
								id="new-password"
								type="password"
								required
								minLength={8}
								autoComplete="new-password"
								value={next}
								onChange={(e) => setNext(e.target.value)}
							/>
						</div>
						<Button
							type="submit"
							size="sm"
							disabled={busy || setPassword.isPending}
						>
							Save
						</Button>
					</form>
				</dd>
			) : null}
		</>
	);
}

function RouteComponent() {
	const { session } = Route.useRouteContext();
	const queryClient = useQueryClient();
	const subscription = useQuery(orpc.subscribers.mine.queryOptions());
	const [resent, setResent] = useState(false);

	const setMine = useMutation(
		orpc.subscribers.setMine.mutationOptions({
			onSuccess: (data) => {
				queryClient.setQueryData(orpc.subscribers.mine.queryKey(), data);
				toast.success(
					data.subscribed ? "Game emails on." : "Game emails off. Noted.",
				);
			},
			onError: (error: Error) => toast.error(error.message),
		}),
	);

	const resend = async () => {
		if (!session) return;
		const result = await authClient.sendVerificationEmail({
			email: session.user.email,
			callbackURL: "/dashboard",
		});
		if (result.error) {
			toast.error(result.error.message || "Could not send it.");
			return;
		}
		setResent(true);
		toast.success("Sent. Check spam before you check with Sean.");
	};

	const verified = session?.user.emailVerified ?? false;
	const subscribed = subscription.data?.subscribed ?? false;

	return (
		<section className="pt-18 pb-15">
			<h1 className="-ml-[0.05em] font-heading text-[clamp(40px,6vw,80px)] uppercase leading-[1.02] tracking-[0.01em]">
				<span className="block">Welcome, {session?.user.name}.</span>
				<span className="block text-steel-700">You're on the list.</span>
			</h1>
			<div className="mt-10">
				<SectionKicker className="mb-5">05 · Your account</SectionKicker>
			</div>
			<Blueprint className="max-w-[560px] p-6">
				<dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-3 text-[15px] leading-6">
					<dt className="kicker text-steel-700">Name</dt>
					<dd className="m-0">{session?.user.name}</dd>
					<dt className="kicker text-steel-700">Email</dt>
					<dd className="m-0">
						{session?.user.email}
						{verified ? (
							<span className="ml-2 text-[13px] text-neutral-700">
								Verified
							</span>
						) : (
							<span className="ml-2 inline-flex flex-wrap items-baseline gap-x-2 text-[13px] text-neutral-700">
								Not verified.
								{resent ? (
									<span>Sent.</span>
								) : (
									<Button variant="link" size="xs" onClick={resend}>
										Resend the email
									</Button>
								)}
							</span>
						)}
					</dd>
					<dt className="kicker text-steel-700">Game emails</dt>
					<dd className="m-0 flex flex-wrap items-baseline gap-x-3">
						<span>
							{subscription.isLoading
								? "Checking..."
								: subscribed
									? "On. Gym booked, game-day headcount."
									: "Off. You find out from the group chat."}
						</span>
						{subscription.isLoading ? null : (
							<Button
								variant="link"
								size="xs"
								disabled={setMine.isPending}
								onClick={() => setMine.mutate({ subscribed: !subscribed })}
							>
								{subscribed ? "Turn off" : "Turn on"}
							</Button>
						)}
					</dd>
					<PasswordRow />
				</dl>
			</Blueprint>
		</section>
	);
}
