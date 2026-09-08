import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { gamesRouter } from "./games";
import { mailRouter } from "./mail";
import { permitsRouter } from "./permits";
import { rsvpRouter } from "./rsvp";
import { subscribersRouter } from "./subscribers";

export const appRouter = {
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	privateData: protectedProcedure.handler(({ context }) => {
		return {
			message: "This is private",
			user: context.session?.user,
		};
	}),
	games: gamesRouter,
	permits: permitsRouter,
	rsvp: rsvpRouter,
	subscribers: subscribersRouter,
	mail: mailRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
