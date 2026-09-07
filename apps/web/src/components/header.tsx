import { buttonVariants } from "@pickup-bball/ui/components/button";
import { Link } from "@tanstack/react-router";

import { SITE_NAME } from "@/content/run";

import UserMenu from "./user-menu";

const linkClass =
	"text-sm text-ink no-underline hover:text-steel-700 aria-[current=page]:text-steel-700";

export default function Header() {
	return (
		<header className="border-divider border-b">
			<nav className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-1.5 px-[clamp(20px,5vw,72px)] py-2.5">
				<Link
					to="/"
					className="mr-auto font-heading font-semibold text-ink text-lg uppercase tracking-[0.02em] no-underline hover:text-steel-700"
				>
					{SITE_NAME}
				</Link>
				<Link to="/" activeOptions={{ exact: true }} className={linkClass}>
					This week
				</Link>
				<Link to="/schedule" className={linkClass}>
					Schedule
				</Link>
				<Link to="/roster" className={linkClass}>
					Roster
				</Link>
				<Link to="/rules" className={linkClass}>
					Rules
				</Link>
				<Link
					to="/"
					hash="rsvp"
					className={buttonVariants({ size: "sm", className: "no-underline" })}
				>
					I'm in
				</Link>
				<UserMenu />
			</nav>
		</header>
	);
}
