import { Blueprint } from "@pickup-bball/ui/components/blueprint";
import { Button } from "@pickup-bball/ui/components/button";
import { Input } from "@pickup-bball/ui/components/input";
import { Label } from "@pickup-bball/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_admin/admin/permits")({
	component: AdminPermitsPage,
});

function formatSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminPermitsPage() {
	const queryClient = useQueryClient();
	const permits = useQuery(orpc.permits.list.queryOptions());
	const [label, setLabel] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [confirmId, setConfirmId] = useState<string | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);

	const refresh = () => {
		queryClient.invalidateQueries({ queryKey: orpc.permits.key() });
		queryClient.invalidateQueries({ queryKey: orpc.games.key() });
		queryClient.invalidateQueries({ queryKey: orpc.rsvp.key() });
	};
	const onError = (error: Error) => toast.error(error.message);

	const upload = useMutation(
		orpc.permits.upload.mutationOptions({
			onSuccess: () => {
				toast.success("Permit filed.");
				setLabel("");
				setFile(null);
				if (fileInput.current) fileInput.current.value = "";
				refresh();
			},
			onError,
		}),
	);
	const remove = useMutation(
		orpc.permits.remove.mutationOptions({
			onSuccess: () => {
				toast.success("Permit deleted.");
				setConfirmId(null);
				refresh();
			},
			onError,
		}),
	);

	return (
		<div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
			<Blueprint className="p-6">
				<span className="kicker mb-3 block text-steel-700">File a permit</span>
				<form
					className="space-y-4"
					onSubmit={(e) => {
						e.preventDefault();
						if (!file) {
							toast.error("Pick the PDF first.");
							return;
						}
						upload.mutate({ label, file });
					}}
				>
					<div className="space-y-1.5">
						<Label htmlFor="label">Label</Label>
						<Input
							id="label"
							required
							maxLength={80}
							placeholder="Shady Grove, Sep 14 - 28"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="file">PDF</Label>
						<Input
							id="file"
							ref={fileInput}
							type="file"
							accept="application/pdf,.pdf"
							required
							className="file:mr-3 file:border-0 file:bg-transparent file:font-heading file:font-semibold file:text-steel-700"
							onChange={(e) => setFile(e.target.files?.[0] ?? null)}
						/>
						<p className="text-[13px] text-neutral-700 leading-5">
							PDF only, up to 10 MB. Anyone with the link can open it.
						</p>
					</div>
					<Button type="submit" disabled={upload.isPending}>
						{upload.isPending ? "Uploading..." : "File it"}
					</Button>
				</form>
			</Blueprint>

			<div>
				<span className="kicker mb-3 block text-steel-700">On file</span>
				{(permits.data ?? []).length === 0 ? (
					<p className="text-[15px] text-neutral-700 leading-6">
						No permits yet. The front desk will notice.
					</p>
				) : (
					<ul className="space-y-4">
						{(permits.data ?? []).map((p) => (
							<li key={p.id}>
								<Blueprint className="flex flex-wrap items-start gap-x-6 gap-y-2 p-4">
									<div className="min-w-0 flex-1">
										<span className="block font-heading font-semibold text-xl uppercase leading-6 tracking-[0.02em]">
											{p.label}
										</span>
										<span className="block text-[13px] text-neutral-700 leading-5">
											{p.fileName} · {formatSize(p.size)}
										</span>
										<span className="block text-[13px] text-neutral-700 leading-5">
											{p.games.length === 0
												? "Not attached to a game yet."
												: `Games: ${p.games.map((g) => g.dateLabel).join(", ")}`}
										</span>
									</div>
									<div className="flex gap-2">
										<a
											href={`/api/permits/${p.id}/file`}
											target="_blank"
											rel="noreferrer"
											className="kicker text-steel-700 no-underline hover:text-steel-900"
										>
											View
										</a>
										<Button
											variant={confirmId === p.id ? "destructive" : "ghost"}
											size="xs"
											disabled={remove.isPending}
											onClick={() => {
												if (confirmId === p.id) {
													remove.mutate({ id: p.id });
												} else {
													setConfirmId(p.id);
												}
											}}
										>
											{confirmId === p.id ? "Really delete" : "Delete"}
										</Button>
									</div>
								</Blueprint>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
