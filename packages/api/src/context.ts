import { createAuth } from "@pickup-bball/auth";
import { createDb } from "@pickup-bball/db";
import { env } from "@pickup-bball/env/server";

export async function createContext({ req }: { req: Request }) {
	const session = await createAuth().api.getSession({
		headers: req.headers,
	});
	return {
		auth: null,
		session,
		db: createDb(),
		env,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
