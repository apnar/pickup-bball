import { Button } from "@pickup-bball/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_admin/admin/users")({
	component: AdminUsersPage,
});

const USERS_KEY = ["admin", "users"] as const;

function AdminUsersPage() {
	const queryClient = useQueryClient();
	const { session } = Route.useRouteContext();
	const users = useQuery({
		queryKey: USERS_KEY,
		queryFn: async () => {
			const result = await authClient.admin.listUsers({
				query: { limit: 200, sortBy: "createdAt", sortDirection: "asc" },
			});
			if (result.error) throw new Error(result.error.message);
			return result.data.users;
		},
	});

	const setRole = useMutation({
		mutationFn: async (input: { userId: string; role: "admin" | "user" }) => {
			const result = await authClient.admin.setRole(input);
			if (result.error) throw new Error(result.error.message);
			return result.data;
		},
		onSuccess: (_data, input) => {
			toast.success(input.role === "admin" ? "Promoted." : "Demoted.");
			queryClient.invalidateQueries({ queryKey: USERS_KEY });
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<div>
			<span className="kicker mb-3 block text-steel-700">Accounts</span>
			<p className="mb-6 max-w-[60ch] text-[15px] text-neutral-700 leading-6">
				Admins can book games, file permits and promote others. You cannot
				demote yourself; find another admin to do that to you.
			</p>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[560px] border-collapse text-sm">
					<thead>
						<tr>
							{["Name", "Email", "Role", ""].map((h, i) => (
								<th
									key={h || `col-${i}`}
									className="border-divider border-b px-2 py-1.5 text-left font-medium text-[11px] text-ink/60 uppercase tracking-[0.08em]"
								>
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{(users.data ?? []).map((u) => {
							const admin = u.role === "admin";
							const isSelf = u.id === session?.user.id;
							return (
								<tr
									key={u.id}
									className="border-ink/8 border-b [&>td]:px-2 [&>td]:py-2"
								>
									<td className="whitespace-nowrap font-heading font-semibold text-lg uppercase tracking-[0.02em]">
										{u.name}
									</td>
									<td>{u.email}</td>
									<td>
										<span
											className={`inline-flex items-center px-2.5 py-[3px] text-[11px] tracking-[0.02em] ${admin ? "bg-steel-100 text-steel-800" : "bg-neutral-100 text-neutral-800"}`}
										>
											{admin ? "Admin" : "Player"}
										</span>
									</td>
									<td className="text-right">
										<Button
											variant="ghost"
											size="xs"
											disabled={isSelf || setRole.isPending}
											onClick={() =>
												setRole.mutate({
													userId: u.id,
													role: admin ? "user" : "admin",
												})
											}
										>
											{admin ? "Remove admin" : "Make admin"}
										</Button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
