import { isAdmin } from "@pickup-bball/api/run";
import { Button } from "@pickup-bball/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@pickup-bball/ui/components/dropdown-menu";
import {
	Link,
	useNavigate,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
	const navigate = useNavigate();
	const router = useRouter();
	const { session } = useRouteContext({ from: "__root__" });

	if (!session) {
		return (
			<Link
				to="/login"
				className="text-ink text-sm no-underline hover:text-steel-700 aria-[current=page]:text-steel-700"
			>
				Sign in
			</Link>
		);
	}

	const admin = isAdmin(session.user);

	return (
		<>
			{admin ? (
				<Link
					to="/admin"
					className="text-ink text-sm no-underline hover:text-steel-700 aria-[current=page]:text-steel-700"
				>
					Admin
				</Link>
			) : null}
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
					{session.user.name}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuGroup>
						<DropdownMenuLabel>My account</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem>{session.user.email}</DropdownMenuItem>
						<DropdownMenuItem
							render={<Link to="/dashboard" className="no-underline" />}
						>
							Dashboard
						</DropdownMenuItem>
						{admin ? (
							<DropdownMenuItem
								render={<Link to="/admin" className="no-underline" />}
							>
								Admin
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem
							variant="destructive"
							onClick={() => {
								authClient.signOut({
									fetchOptions: {
										onSuccess: async () => {
											// The session came from the root route; make the
											// router go and notice it is gone.
											await router.invalidate();
											navigate({ to: "/" });
										},
									},
								});
							}}
						>
							Sign out
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}
