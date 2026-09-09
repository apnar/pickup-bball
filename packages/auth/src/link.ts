import type { createDb } from "@pickup-bball/db";
import {
	attachSubscriberUser,
	findSubscriberByLinkToken,
} from "@pickup-bball/db/subscribers";
import { safeReturnPath } from "@pickup-bball/email";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

type Db = ReturnType<typeof createDb>;

/**
 * Sign-in by link. Every link we email a subscriber carries their
 * `link_token`; clicking one is how a player gets in, no password ever.
 * The token is a bearer credential, which is why the emails say not to
 * forward them and why the permit URL never carries one.
 *
 * Served at `/api/auth/link?k=<token>&to=<path>`. GET, so Better Auth's
 * origin check does not apply. The param is `k`, not `callbackURL`: that
 * name is spoken for.
 */
export function emailLink({ db }: { db: Db }) {
	return {
		id: "email-link",
		endpoints: {
			signInByEmailLink: createAuthEndpoint(
				"/link",
				{
					method: "GET",
					query: z.object({
						k: z.string().min(1),
						to: z.string().optional(),
					}),
				},
				async (ctx) => {
					// context.baseURL ends in /api/auth; links land on the site itself.
					const site = new URL(ctx.context.baseURL).origin;
					const subscriber = await findSubscriberByLinkToken(db, ctx.query.k);
					// Unsubscribing stops the emails, not the sign-in: an old link in
					// the inbox still works. Removal by an admin deletes the token.
					if (!subscriber) {
						throw ctx.redirect(`${site}/login?error=link`);
					}

					const found = await ctx.context.internalAdapter.findUserByEmail(
						subscriber.email,
					);
					let user = found?.user;
					if (!user) {
						user = await ctx.context.internalAdapter.createUser(
							{
								email: subscriber.email,
								// `name` is NOT NULL; the local part will do until they
								// tell us otherwise.
								name: subscriber.name ?? subscriber.email.split("@")[0] ?? "",
								emailVerified: true,
							},
							{ method: "email-link" },
						);
					} else if (!user.emailVerified) {
						// They came from the old public sign-up and never clicked the
						// verification email. Clicking this one proves the address.
						// Better Auth's magic-link would wipe their password here; we
						// keep it, because these are real players.
						await ctx.context.internalAdapter.updateUser(user.id, {
							emailVerified: true,
						});
					}

					await attachSubscriberUser(db, subscriber.id, user.id);

					// No second argument: it means "don't remember me" and would cut
					// the session to a day.
					const session = await ctx.context.internalAdapter.createSession(
						user.id,
					);
					await setSessionCookie(ctx, { session, user });
					throw ctx.redirect(
						new URL(safeReturnPath(ctx.query.to), site).toString(),
					);
				},
			),
		},
		rateLimit: [
			{ pathMatcher: (path: string) => path === "/link", window: 60, max: 10 },
		],
	} satisfies BetterAuthPlugin;
}
