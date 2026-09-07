/// <reference types="@cloudflare/workers-types" />

// Keep in sync with the `vars`, secrets and bindings in apps/web/wrangler.jsonc.
export interface CloudflareEnv {
	/** D1 database binding. */
	DB: D1Database;
	/** R2 bucket holding gym permit PDFs. */
	PERMITS: R2Bucket;
	/** Secret: `wrangler secret put BETTER_AUTH_SECRET` (or .dev.vars locally). */
	BETTER_AUTH_SECRET: string;
	/** Public origin of the deployed Worker (wrangler.jsonc `vars`). */
	BETTER_AUTH_URL: string;
}

declare module "cloudflare:workers" {
	namespace Cloudflare {
		interface Env extends CloudflareEnv {}
	}
}
