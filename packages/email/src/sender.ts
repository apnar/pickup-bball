import type { Address } from "./brevo";

/**
 * The verified sender in Brevo. The display name mirrors SITE_NAME in
 * apps/web/src/content/run.ts; change both together.
 */
export const SENDER: Address = {
	name: "Sean's Monday Night Run",
	email: "info@moco-pickup.com",
};
