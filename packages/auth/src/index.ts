import { createDb } from "@pickup-bball/db";
import * as schema from "@pickup-bball/db/schema/auth";
import { upsertSubscriber } from "@pickup-bball/db/subscribers";
import { resetPasswordEmail, verifyEmail } from "@pickup-bball/email";
import { getMailer } from "@pickup-bball/email/worker";
import { env } from "@pickup-bball/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { emailLink } from "./link";

export function createAuth() {
	const db = createDb();

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",

			schema: schema,
		}),
		trustedOrigins: [env.BETTER_AUTH_URL],
		emailAndPassword: {
			enabled: true,
			// Nobody signs themselves up any more: an admin adds the address and
			// the welcome email carries the way in.
			disableSignUp: true,
			// Verification is encouraged, not enforced: nobody gets locked out of
			// the headcount over a missed email.
			requireEmailVerification: false,
			sendResetPassword: async ({ user, url }) => {
				const outcome = await getMailer().sendOne(
					{ email: user.email, name: user.name },
					resetPasswordEmail({ name: user.name, url }),
					{ tags: ["auth", "reset-password"] },
				);
				if (!outcome.ok) {
					console.error("reset password email failed", outcome);
				}
			},
		},
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }) => {
				const outcome = await getMailer().sendOne(
					{ email: user.email, name: user.name },
					verifyEmail({ name: user.name, url }),
					{ tags: ["auth", "verify-email"] },
				);
				if (!outcome.ok) {
					console.error("verification email failed", outcome);
				}
			},
		},
		databaseHooks: {
			user: {
				create: {
					// New accounts join the list. A past unsubscribe is respected.
					after: async (user) => {
						try {
							await upsertSubscriber(db, {
								email: user.email,
								name: user.name,
								source: "signup",
								userId: user.id,
								reactivate: false,
							});
						} catch (error) {
							console.error("subscriber upsert failed", error);
						}
					},
				},
			},
		},
		session: {
			// Half a year, rolling. Players sign in from an email link once and
			// then stop thinking about it.
			expiresIn: 60 * 60 * 24 * 180,
			updateAge: 60 * 60 * 24,
			// The session cookie carries the user for five minutes, so ordinary
			// navigation costs no D1 read. A role changed by SQL takes that long
			// to show up.
			cookieCache: { enabled: true, maxAge: 5 * 60 },
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		plugins: [
			admin({ adminRoles: ["admin"], defaultRole: "user" }),
			emailLink({ db }),
			// Must stay last.
			tanstackStartCookies(),
		],
	});
}
