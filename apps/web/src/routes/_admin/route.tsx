import { isAdmin } from "@pickup-bball/api/run";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";

import PageTitle from "@/components/page-title";
import { getUser } from "@/functions/get-user";

export const Route = createFileRoute("/_admin")({
	beforeLoad: async () => {
		const session = await getUser();
		if (!session) {
			throw redirect({ to: "/login" });
		}
		if (!isAdmin(session.user)) {
			throw redirect({ to: "/" });
		}
		return { session };
	},
	component: AdminLayout,
});

const tabClass =
	"kicker border-b-2 border-transparent pb-2 text-ink no-underline hover:text-steel-700 aria-[current=page]:border-steel aria-[current=page]:text-steel-700";

function AdminLayout() {
	return (
		<section className="pt-18 pb-15">
			<PageTitle line1="Front office." line2="Book the gym. File the permit." />
			<p className="mt-7 mb-10 max-w-[60ch] text-base leading-6">
				Games only exist once a court is rented. Put the date in, attach the
				permit, and the headcount opens on the home page.
			</p>
			<nav className="mb-8 flex gap-6 border-divider border-b">
				<Link to="/admin" activeOptions={{ exact: true }} className={tabClass}>
					Games
				</Link>
				<Link to="/admin/permits" className={tabClass}>
					Permits
				</Link>
				<Link to="/admin/users" className={tabClass}>
					Users
				</Link>
				<Link to="/admin/email" className={tabClass}>
					Email
				</Link>
			</nav>
			<Outlet />
		</section>
	);
}
