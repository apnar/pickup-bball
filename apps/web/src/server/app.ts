import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { StrictGetMethodPlugin } from "@orpc/server/plugins";
import { createContext } from "@pickup-bball/api/context";
import { appRouter } from "@pickup-bball/api/routers/index";
import { createAuth } from "@pickup-bball/auth";
import { createDb } from "@pickup-bball/db";
import { permit } from "@pickup-bball/db/schema/permit";
import { env } from "@pickup-bball/env/server";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { brevoWebhook } from "./brevo-webhook";
import { unsubscribe } from "./unsubscribe";

/**
 * No OpenAPI handler and no /api/reference: the browser client speaks the
 * RPC protocol, and a public, self-describing list of every procedure and
 * its schema was a map of the site handed to strangers for nothing.
 */
const rpcHandler = new RPCHandler(appRouter, {
	plugins: [
		// The RPC protocol also accepts GET with the input in `?data=`, and the
		// session cookie is SameSite=Lax, which browsers send on a top-level
		// GET. Without this, a link in a chat or an email could suspend the
		// player who clicks it, or make the admin who clicks it mail the whole
		// list. Nothing here is declared GET, so every call must be a POST.
		new StrictGetMethodPlugin(),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

/**
 * The Hono app that serves everything under /api. It runs inside the
 * TanStack Start Worker (see routes/api/$.ts), so it shares the origin with
 * the web app: no CORS and ordinary same-site cookies.
 */
export const app = new Hono().basePath("/api");

/**
 * Method, path and status only. The sign-in link carries its bearer token in
 * the query string, and anything that prints the full URL turns the Worker
 * logs into a list of everybody's credentials.
 */
app.use(async (c, next) => {
	const start = Date.now();
	await next();
	console.log(
		`${c.req.method} ${new URL(c.req.url).pathname} ${c.res.status} ${Date.now() - start}ms`,
	);
});

/**
 * Two admin-plugin endpoints the site never calls and should not have. One
 * signs an admin in as anybody; the other sets anybody's password. Either is
 * a stolen admin cookie turned into every account on the list, so they are
 * closed here, before Better Auth ever sees them.
 */
app.on(
	["GET", "POST"],
	["/auth/admin/impersonate-user", "/auth/admin/set-user-password"],
	(c) => c.text("Not found.", 404),
);

app.on(["GET", "POST"], "/auth/*", (c) => createAuth().handler(c.req.raw));

app.all("/rpc/*", async (c, next) => {
	const result = await rpcHandler.handle(c.req.raw, {
		prefix: "/api/rpc",
		context: await createContext({ req: c.req.raw }),
	});
	if (result.matched) {
		return c.newResponse(result.response.body, result.response);
	}
	await next();
});

/**
 * Streams a permit PDF from R2. Readable by anyone with the link, by design:
 * the point is to show it to gym staff from whatever phone is handy.
 * Add `?download=1` to get an attachment instead of an inline view.
 */
app.get("/permits/:id/file", async (c) => {
	const row = await createDb()
		.select({
			r2Key: permit.r2Key,
			fileName: permit.fileName,
			contentType: permit.contentType,
		})
		.from(permit)
		.where(eq(permit.id, c.req.param("id")))
		.get();
	if (!row) return c.text("No such permit.", 404);

	const object = await env.PERMITS.get(row.r2Key);
	if (!object) return c.text("Permit file is missing.", 404);

	const disposition = c.req.query("download") ? "attachment" : "inline";
	const safeName = row.fileName.replace(/[^\w.\- ]+/g, "_");
	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("content-type", row.contentType);
	headers.set("content-length", String(object.size));
	headers.set("etag", object.httpEtag);
	headers.set("cache-control", "public, max-age=3600");
	headers.set("content-disposition", `${disposition}; filename="${safeName}"`);
	// A PDF is the only thing this ever serves, and a PDF viewer is the only
	// thing that should run anything in it. `sandbox` keeps a PDF that is
	// secretly something else from running as this origin.
	headers.set("x-content-type-options", "nosniff");
	headers.set("content-security-policy", "sandbox");
	return new Response(object.body, { headers });
});

app.route("/unsubscribe", unsubscribe);
app.route("/brevo/webhook", brevoWebhook);

app.get("/health", (c) => c.text("OK"));
