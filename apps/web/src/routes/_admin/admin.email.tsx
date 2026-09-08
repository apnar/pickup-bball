import { Blueprint } from "@pickup-bball/ui/components/blueprint";
import { Button } from "@pickup-bball/ui/components/button";
import { Input } from "@pickup-bball/ui/components/input";
import { Label } from "@pickup-bball/ui/components/label";
import { Textarea } from "@pickup-bball/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_admin/admin/email")({
	component: AdminEmailPage,
});

type Preview = { subject: string; html: string; text: string };
type ListOutcome = {
	attempted: number;
	sent: number;
	failed: { emails: string[]; error: string }[];
};

const thClass =
	"border-divider border-b px-2 py-1.5 text-left font-medium text-[11px] text-ink/60 uppercase tracking-[0.08em]";
const chip = (tone: "steel" | "neutral" | "warn") =>
	`inline-flex items-center px-2.5 py-[3px] text-[11px] tracking-[0.02em] ${
		tone === "steel"
			? "bg-steel-100 text-steel-800"
			: tone === "warn"
				? "bg-amber-100 text-amber-900"
				: "bg-neutral-100 text-neutral-800"
	}`;

function when(value: Date | string | null | undefined): string {
	if (!value) return "";
	return new Date(value).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function reportSend(result: ListOutcome) {
	const failed = result.attempted - result.sent;
	if (failed === 0) {
		toast.success(`Sent to ${result.sent}.`);
	} else {
		toast.warning(
			`Sent to ${result.sent}, ${failed} failed. See recent sends.`,
		);
	}
}

function PreviewPanel({
	preview,
	onClose,
}: {
	preview: Preview & { recipientCount: number };
	onClose: () => void;
}) {
	const [showText, setShowText] = useState(false);
	return (
		<Blueprint className="p-5">
			<div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
				<span className="kicker text-steel-700">
					Preview · goes to {preview.recipientCount}
				</span>
				<div className="flex gap-2">
					<Button
						variant="ghost"
						size="xs"
						onClick={() => setShowText((v) => !v)}
					>
						{showText ? "Show HTML" : "Show plain text"}
					</Button>
					<Button variant="ghost" size="xs" onClick={onClose}>
						Close
					</Button>
				</div>
			</div>
			<p className="mb-3 text-sm">
				<span className="text-neutral-700">Subject:</span>{" "}
				<span className="font-semibold">{preview.subject}</span>
			</p>
			{showText ? (
				<pre className="max-h-[480px] overflow-auto whitespace-pre-wrap border border-divider bg-surface p-3 font-mono text-xs leading-5">
					{preview.text}
				</pre>
			) : (
				<iframe
					title="Email preview"
					sandbox=""
					srcDoc={preview.html}
					className="h-[480px] w-full border border-divider bg-white"
				/>
			)}
		</Blueprint>
	);
}

function AdminEmailPage() {
	const queryClient = useQueryClient();
	const status = useQuery(orpc.mail.status.queryOptions());
	const games = useQuery(orpc.games.list.queryOptions());
	const subscribers = useQuery(orpc.subscribers.list.queryOptions());
	const recent = useQuery(orpc.mail.recent.queryOptions());

	const [preview, setPreview] = useState<
		(Preview & { recipientCount: number; key: string }) | null
	>(null);
	const [confirmKey, setConfirmKey] = useState<string | null>(null);
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [newEmail, setNewEmail] = useState("");
	const [newName, setNewName] = useState("");

	const onError = (error: Error) => toast.error(error.message);
	const refreshAll = () => {
		queryClient.invalidateQueries({ queryKey: orpc.games.key() });
		queryClient.invalidateQueries({ queryKey: orpc.mail.key() });
		queryClient.invalidateQueries({ queryKey: orpc.subscribers.key() });
		setConfirmKey(null);
	};

	const previewAnnouncement = useMutation(
		orpc.mail.previewAnnouncement.mutationOptions({
			onSuccess: (data, input) =>
				setPreview({ ...data, key: `announce:${input.gameId}` }),
			onError,
		}),
	);
	const previewReminder = useMutation(
		orpc.mail.previewReminder.mutationOptions({
			onSuccess: (data, input) =>
				setPreview({ ...data, key: `remind:${input.gameId}` }),
			onError,
		}),
	);
	const previewMessage = useMutation(
		orpc.mail.previewMessage.mutationOptions({
			onSuccess: (data) => setPreview({ ...data, key: "message" }),
			onError,
		}),
	);
	const sendAnnouncement = useMutation(
		orpc.mail.sendAnnouncement.mutationOptions({
			onSuccess: (result) => {
				reportSend(result);
				refreshAll();
			},
			onError,
		}),
	);
	const sendReminder = useMutation(
		orpc.mail.sendReminder.mutationOptions({
			onSuccess: (result) => {
				reportSend({
					attempted: result.recipients,
					sent: result.recipients - result.failed,
					failed: [],
				});
				refreshAll();
			},
			onError,
		}),
	);
	const sendMessage = useMutation(
		orpc.mail.sendMessage.mutationOptions({
			onSuccess: (result, input) => {
				if (input.toSelf) {
					toast.success("Sent to you. Go look.");
				} else {
					reportSend(result);
					setSubject("");
					setBody("");
					setPreview(null);
				}
				refreshAll();
			},
			onError,
		}),
	);
	const addSubscriber = useMutation(
		orpc.subscribers.add.mutationOptions({
			onSuccess: (result) => {
				toast.success(result.created ? "Added." : "Already there; kept.");
				setNewEmail("");
				setNewName("");
				refreshAll();
			},
			onError,
		}),
	);
	const removeSubscriber = useMutation(
		orpc.subscribers.remove.mutationOptions({
			onSuccess: () => {
				toast.success("Removed.");
				refreshAll();
			},
			onError,
		}),
	);

	const upcoming = games.data?.upcoming ?? [];
	const nextAnnounced = upcoming.find((g) => g.announcedAt);
	const recipientCount = status.data?.recipientCount ?? 0;
	const sending =
		sendAnnouncement.isPending ||
		sendReminder.isPending ||
		sendMessage.isPending;

	const confirmButton = (
		key: string,
		label: string,
		onConfirm: () => void,
		disabled = false,
	) => (
		<Button
			variant={confirmKey === key ? "default" : "outline"}
			size="xs"
			disabled={disabled || sending}
			onClick={() => {
				if (confirmKey === key) {
					onConfirm();
				} else {
					setConfirmKey(key);
				}
			}}
		>
			{confirmKey === key ? `Really send to ${recipientCount}` : label}
		</Button>
	);

	return (
		<div className="space-y-12">
			{status.data?.dryRun ? (
				<p className="border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 leading-5">
					BREVO_API_KEY is not set here, so emails are printed to the server log
					instead of sent. Everything else works the same.
				</p>
			) : null}

			<div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
				<div className="space-y-10">
					<div>
						<span className="kicker mb-3 block text-steel-700">
							Upcoming games · {recipientCount} on the list
						</span>
						{upcoming.length === 0 ? (
							<p className="text-[15px] text-neutral-700 leading-6">
								Nothing booked. Book a game first, then tell people.
							</p>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full min-w-[520px] border-collapse text-sm">
									<thead>
										<tr>
											{["Game", "Announced", "Reminder", ""].map((h, i) => (
												<th key={h || `col-${i}`} className={thClass}>
													{h}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{upcoming.map((g) => {
											const aKey = `announce:${g.id}`;
											const rKey = `remind:${g.id}`;
											return (
												<tr
													key={g.id}
													className="border-ink/8 border-b [&>td]:px-2 [&>td]:py-2"
												>
													<td>
														<div className="whitespace-nowrap font-heading font-semibold text-lg uppercase tracking-[0.02em]">
															{g.dateLabel}
														</div>
														<div className="text-[13px] text-neutral-700">
															{g.timeLabel} · {g.location} · {g.inCount} in
														</div>
													</td>
													<td className="whitespace-nowrap text-[13px]">
														{g.announcedAt ? (
															<span className={chip("steel")}>
																{when(g.announcedAt)}
															</span>
														) : (
															<span className={chip("neutral")}>Not yet</span>
														)}
													</td>
													<td className="whitespace-nowrap text-[13px]">
														{g.reminderSentAt ? (
															<span className={chip("steel")}>
																{when(g.reminderSentAt)}
															</span>
														) : (
															<span className={chip("neutral")}>
																Auto, 9 AM game day
															</span>
														)}
													</td>
													<td className="text-right">
														<div className="flex flex-col items-end gap-1">
															<Button
																variant="ghost"
																size="xs"
																onClick={() =>
																	previewAnnouncement.mutate({ gameId: g.id })
																}
															>
																Preview
															</Button>
															{confirmButton(
																aKey,
																g.announcedAt ? "Announce again" : "Announce",
																() => sendAnnouncement.mutate({ gameId: g.id }),
																preview?.key !== aKey,
															)}
															<Button
																variant="ghost"
																size="xs"
																onClick={() =>
																	previewReminder.mutate({ gameId: g.id })
																}
															>
																Preview reminder
															</Button>
															{g.reminderSentAt
																? null
																: confirmButton(
																		rKey,
																		"Remind now",
																		() => sendReminder.mutate({ gameId: g.id }),
																		preview?.key !== rKey,
																	)}
														</div>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
								<p className="mt-2 text-[12px] text-neutral-600 leading-5">
									Send buttons unlock after you preview that email.
								</p>
							</div>
						)}
					</div>

					<Blueprint className="p-6">
						<span className="kicker mb-3 block text-steel-700">
							Message the list
						</span>
						<form
							className="space-y-4"
							onSubmit={(e) => {
								e.preventDefault();
								previewMessage.mutate({ subject, body });
							}}
						>
							<div className="space-y-1.5">
								<Label htmlFor="subject">Subject</Label>
								<Input
									id="subject"
									required
									maxLength={120}
									placeholder="Gym is closed Monday"
									value={subject}
									onChange={(e) => setSubject(e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="body">Body</Label>
								<Textarea
									id="body"
									required
									maxLength={5000}
									rows={6}
									className="min-h-32 text-sm"
									placeholder="Boiler blew. See you next week. Bring a jacket."
									value={body}
									onChange={(e) => setBody(e.target.value)}
								/>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button type="submit" variant="outline" size="sm">
									Preview
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={!subject || !body || sending}
									onClick={() =>
										sendMessage.mutate({ subject, body, toSelf: true })
									}
								>
									Send to me first
								</Button>
								<Button
									type="button"
									variant={confirmKey === "message" ? "default" : "outline"}
									size="sm"
									disabled={preview?.key !== "message" || sending}
									onClick={() => {
										if (confirmKey === "message") {
											sendMessage.mutate({ subject, body, toSelf: false });
										} else {
											setConfirmKey("message");
										}
									}}
								>
									{confirmKey === "message"
										? `Really send to ${recipientCount}`
										: `Send to everyone (${recipientCount})`}
								</Button>
							</div>
						</form>
					</Blueprint>
				</div>

				<div>
					{preview ? (
						<PreviewPanel preview={preview} onClose={() => setPreview(null)} />
					) : (
						<Blueprint className="flex min-h-40 items-center justify-center p-6 text-center text-[15px] text-neutral-700 leading-6">
							Preview an email and it shows up here.
						</Blueprint>
					)}
				</div>
			</div>

			<div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
				<div>
					<span className="kicker mb-3 block text-steel-700">Subscribers</span>
					<form
						className="mb-4 flex flex-wrap items-end gap-3"
						onSubmit={(e) => {
							e.preventDefault();
							addSubscriber.mutate({
								email: newEmail,
								name: newName || undefined,
							});
						}}
					>
						<div className="min-w-[220px] flex-1 space-y-1.5">
							<Label htmlFor="new-email">Email</Label>
							<Input
								id="new-email"
								type="email"
								required
								value={newEmail}
								onChange={(e) => setNewEmail(e.target.value)}
							/>
						</div>
						<div className="min-w-[160px] space-y-1.5">
							<Label htmlFor="new-name">Name</Label>
							<Input
								id="new-name"
								maxLength={40}
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
							/>
						</div>
						<Button type="submit" size="sm" disabled={addSubscriber.isPending}>
							Add
						</Button>
					</form>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[560px] border-collapse text-sm">
							<thead>
								<tr>
									{["Name", "Email", "Source", "Status", ""].map((h, i) => (
										<th key={h || `col-${i}`} className={thClass}>
											{h}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{(subscribers.data ?? []).map((s) => {
									const active = s.status === "active";
									const removeKey = `remove:${s.id}`;
									return (
										<tr
											key={s.id}
											className="border-ink/8 border-b [&>td]:px-2 [&>td]:py-2"
										>
											<td className="whitespace-nowrap font-heading font-semibold text-lg uppercase tracking-[0.02em]">
												{s.name ?? <span className="text-neutral-500">—</span>}
											</td>
											<td>{s.email}</td>
											<td className="text-[13px] capitalize">{s.source}</td>
											<td>
												<span className={chip(active ? "steel" : "neutral")}>
													{active ? "Active" : "Unsubscribed"}
												</span>
											</td>
											<td className="whitespace-nowrap text-right">
												{active && nextAnnounced ? (
													<Button
														variant="ghost"
														size="xs"
														disabled={sending}
														onClick={() =>
															sendAnnouncement.mutate({
																gameId: nextAnnounced.id,
																subscriberIds: [s.id],
															})
														}
													>
														Resend announcement
													</Button>
												) : null}
												<Button
													variant={
														confirmKey === removeKey ? "destructive" : "ghost"
													}
													size="xs"
													disabled={removeSubscriber.isPending}
													onClick={() => {
														if (confirmKey === removeKey) {
															removeSubscriber.mutate({ id: s.id });
														} else {
															setConfirmKey(removeKey);
														}
													}}
												>
													{confirmKey === removeKey
														? "Really remove"
														: "Remove"}
												</Button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						{subscribers.data?.length === 0 ? (
							<p className="mt-3 text-[15px] text-neutral-700 leading-6">
								Nobody yet. Add the regulars, or send them to the home page.
							</p>
						) : null}
					</div>
				</div>

				<div>
					<span className="kicker mb-3 block text-steel-700">Recent sends</span>
					{(recent.data ?? []).length === 0 ? (
						<p className="text-[15px] text-neutral-700 leading-6">
							Nothing sent yet.
						</p>
					) : (
						<ul className="m-0 list-none space-y-3 p-0">
							{(recent.data ?? []).map((row) => (
								<li
									key={row.id}
									className="border-ink/8 border-b pb-3 text-sm leading-5"
								>
									<div className="flex flex-wrap items-baseline justify-between gap-x-3">
										<span className="font-semibold">{row.subject}</span>
										<span className="text-[12px] text-neutral-600">
											{when(row.createdAt)}
										</span>
									</div>
									<div className="text-[13px] text-neutral-700">
										<span className="capitalize">{row.kind}</span> ·{" "}
										{row.recipientCount} recipient
										{row.recipientCount === 1 ? "" : "s"}
										{row.failedCount > 0 ? (
											<span className={`ml-2 ${chip("warn")}`}>
												{row.failedCount} failed
											</span>
										) : null}
									</div>
									{row.errors.length > 0 ? (
										<details className="mt-1 text-[12px] text-neutral-700">
											<summary className="cursor-pointer">What failed</summary>
											{row.errors.map((e) => (
												<p
													key={e.error + e.emails.join(",")}
													className="m-0 mt-1"
												>
													{e.emails.join(", ")}: {e.error}
												</p>
											))}
										</details>
									) : null}
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}
