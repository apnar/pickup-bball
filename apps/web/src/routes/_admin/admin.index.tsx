import { Blueprint } from "@pickup-bball/ui/components/blueprint";
import { Button } from "@pickup-bball/ui/components/button";
import { Input } from "@pickup-bball/ui/components/input";
import { Label } from "@pickup-bball/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
	DEFAULT_END_TIME,
	DEFAULT_LOCATION,
	DEFAULT_START_TIME,
} from "@/content/run";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_admin/admin/")({
	component: AdminGamesPage,
});

const selectClass =
	"min-h-9 w-full min-w-0 rounded-none border border-divider bg-surface px-2.5 py-1.5 font-sans text-ink text-sm outline-none hover:border-ink/45 focus-visible:border-steel";

type FormState = {
	date: string;
	startTime: string;
	endTime: string;
	location: string;
	notes: string;
	permitId: string;
};

const emptyForm: FormState = {
	date: "",
	startTime: DEFAULT_START_TIME,
	endTime: DEFAULT_END_TIME,
	location: DEFAULT_LOCATION,
	notes: "",
	permitId: "",
};

function AdminGamesPage() {
	const queryClient = useQueryClient();
	const games = useQuery(orpc.games.list.queryOptions());
	const permits = useQuery(orpc.permits.list.queryOptions());
	const [form, setForm] = useState<FormState>(emptyForm);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [confirmId, setConfirmId] = useState<string | null>(null);

	const refresh = () => {
		queryClient.invalidateQueries({ queryKey: orpc.games.key() });
		queryClient.invalidateQueries({ queryKey: orpc.rsvp.key() });
	};
	const onError = (error: Error) => toast.error(error.message);

	const create = useMutation(
		orpc.games.create.mutationOptions({
			onSuccess: () => {
				toast.success("Game booked.");
				setForm(emptyForm);
				refresh();
			},
			onError,
		}),
	);
	const update = useMutation(
		orpc.games.update.mutationOptions({
			onSuccess: () => {
				toast.success("Game updated.");
				setForm(emptyForm);
				setEditingId(null);
				refresh();
			},
			onError,
		}),
	);
	const remove = useMutation(
		orpc.games.remove.mutationOptions({
			onSuccess: () => {
				toast.success("Game removed.");
				setConfirmId(null);
				refresh();
			},
			onError,
		}),
	);

	const set = (key: keyof FormState) => (value: string) =>
		setForm((f) => ({ ...f, [key]: value }));

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		const payload = {
			date: form.date,
			startTime: form.startTime,
			endTime: form.endTime || null,
			location: form.location,
			notes: form.notes || null,
			permitId: form.permitId || null,
		};
		if (editingId) {
			update.mutate({ id: editingId, ...payload });
		} else {
			create.mutate(payload);
		}
	};

	const allGames = [
		...(games.data?.upcoming ?? []),
		...(games.data?.past ?? []),
	];
	const busy = create.isPending || update.isPending;

	return (
		<div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
			<Blueprint className="p-6">
				<span className="kicker mb-3 block text-steel-700">
					{editingId ? "Edit game" : "Book a game"}
				</span>
				<form onSubmit={submit} className="space-y-4">
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="date">Date</Label>
							<Input
								id="date"
								type="date"
								required
								value={form.date}
								onChange={(e) => set("date")(e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="startTime">Tip-off</Label>
							<Input
								id="startTime"
								type="time"
								required
								value={form.startTime}
								onChange={(e) => set("startTime")(e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="endTime">Ends (optional)</Label>
							<Input
								id="endTime"
								type="time"
								value={form.endTime}
								onChange={(e) => set("endTime")(e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="location">Court</Label>
							<Input
								id="location"
								required
								maxLength={80}
								value={form.location}
								onChange={(e) => set("location")(e.target.value)}
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="permitId">Permit</Label>
						<select
							id="permitId"
							className={selectClass}
							value={form.permitId}
							onChange={(e) => set("permitId")(e.target.value)}
						>
							<option value="">No permit yet</option>
							{(permits.data ?? []).map((p) => (
								<option key={p.id} value={p.id}>
									{p.label} · {p.fileName}
								</option>
							))}
						</select>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="notes">Notes (optional)</Label>
						<Input
							id="notes"
							maxLength={300}
							placeholder="Side door is locked after 7:30."
							value={form.notes}
							onChange={(e) => set("notes")(e.target.value)}
						/>
					</div>
					<div className="flex gap-2.5">
						<Button type="submit" disabled={busy}>
							{editingId ? "Save changes" : "Book it"}
						</Button>
						{editingId ? (
							<Button
								type="button"
								variant="ghost"
								onClick={() => {
									setEditingId(null);
									setForm(emptyForm);
								}}
							>
								Cancel
							</Button>
						) : null}
					</div>
				</form>
			</Blueprint>

			<div>
				<span className="kicker mb-3 block text-steel-700">All games</span>
				{allGames.length === 0 ? (
					<p className="text-[15px] text-neutral-700 leading-6">
						Nothing booked yet.
					</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full min-w-[560px] border-collapse text-sm">
							<thead>
								<tr>
									{["Date", "Tip-off", "Court", "In", "Permit", ""].map(
										(h, i) => (
											<th
												key={h || `col-${i}`}
												className="border-divider border-b px-2 py-1.5 text-left font-medium text-[11px] text-ink/60 uppercase tracking-[0.08em]"
											>
												{h}
											</th>
										),
									)}
								</tr>
							</thead>
							<tbody>
								{allGames.map((g) => (
									<tr
										key={g.id}
										className={`border-ink/8 border-b [&>td]:px-2 [&>td]:py-2 ${g.isPast ? "text-neutral-600" : ""}`}
									>
										<td className="whitespace-nowrap font-heading font-semibold text-lg uppercase tracking-[0.02em]">
											{g.dateLabel}
										</td>
										<td className="tnum whitespace-nowrap">{g.timeLabel}</td>
										<td>{g.location}</td>
										<td className="tnum">{g.inCount}</td>
										<td className="text-[13px]">
											{g.permit ? g.permit.label : "None"}
										</td>
										<td className="whitespace-nowrap text-right">
											<Button
												variant="ghost"
												size="xs"
												onClick={() => {
													setEditingId(g.id);
													setForm({
														date: g.date,
														startTime: g.startTime,
														endTime: g.endTime ?? "",
														location: g.location,
														notes: g.notes ?? "",
														permitId: g.permit?.id ?? "",
													});
												}}
											>
												Edit
											</Button>
											<Button
												variant={confirmId === g.id ? "destructive" : "ghost"}
												size="xs"
												disabled={remove.isPending}
												onClick={() => {
													if (confirmId === g.id) {
														remove.mutate({ id: g.id });
													} else {
														setConfirmId(g.id);
													}
												}}
											>
												{confirmId === g.id ? "Really delete" : "Delete"}
											</Button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
