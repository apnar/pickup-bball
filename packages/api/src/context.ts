import { createAuth } from "@pickup-bball/auth";
import { createDb } from "@pickup-bball/db";

export async function createContext({ req }: { req: Request }) {
	const session = await createAuth().api.getSession({
		headers: req.headers,
	});
	return {
		auth: null,
		session,
		db: createDb(),
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
