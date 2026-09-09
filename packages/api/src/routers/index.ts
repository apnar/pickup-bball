import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { accountRouter } from "./account";
import { gamesRouter } from "./games";
import { mailRouter } from "./mail";
import { permitsRouter } from "./permits";
import { rsvpRouter } from "./rsvp";
import { subscribersRouter } from "./subscribers";

export const appRouter = {
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	account: accountRouter,
	games: gamesRouter,
	permits: permitsRouter,
	rsvp: rsvpRouter,
	subscribers: subscribersRouter,
	mail: mailRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
