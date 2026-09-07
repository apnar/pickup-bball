import { ORPCError } from "@orpc/server";
import { game } from "@pickup-bball/db/schema/game";
import { permit } from "@pickup-bball/db/schema/permit";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";
import { formatGameDate } from "../run";

const MAX_PERMIT_BYTES = 10 * 1024 * 1024;

export const permitsRouter = {
	/** Every permit with the games that reference it. */
	list: adminProcedure.handler(async ({ context }) => {
		const permits = await context.db
			.select()
			.from(permit)
			.orderBy(desc(permit.createdAt))
			.all();
		const games = await context.db
			.select({ id: game.id, date: game.date, permitId: game.permitId })
			.from(game)
			.orderBy(asc(game.date))
			.all();
		return permits.map((p) => ({
			id: p.id,
			label: p.label,
			fileName: p.fileName,
			size: p.size,
			createdAt: p.createdAt,
			games: games
				.filter((g) => g.permitId === p.id)
				.map((g) => ({
					id: g.id,
					date: g.date,
					dateLabel: formatGameDate(g.date),
				})),
		}));
	}),

	/** Store a PDF in R2 and record it. */
	upload: adminProcedure
		.input(
			z.object({
				label: z.string().trim().min(1, "Give it a label.").max(80),
				file: z
					.file()
					.max(MAX_PERMIT_BYTES, "Permits over 10 MB are not permits.")
					.mime(["application/pdf"], "Only PDF permits, please."),
			}),
		)
		.handler(async ({ context, input }) => {
			const id = crypto.randomUUID();
			const r2Key = `permits/${id}.pdf`;
			const fileName = input.file.name || `${input.label}.pdf`;
			await context.env.PERMITS.put(r2Key, input.file, {
				httpMetadata: { contentType: "application/pdf" },
				customMetadata: { fileName, label: input.label },
			});
			await context.db.insert(permit).values({
				id,
				label: input.label,
				r2Key,
				fileName,
				contentType: "application/pdf",
				size: input.file.size,
				uploadedBy: context.session.user.id,
			});
			return { id, label: input.label, fileName, size: input.file.size };
		}),

	/** Delete the file and the record. Games that used it keep playing, unpermitted. */
	remove: adminProcedure
		.input(z.object({ id: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const row = await context.db
				.select({ id: permit.id, r2Key: permit.r2Key })
				.from(permit)
				.where(eq(permit.id, input.id))
				.get();
			if (!row) {
				throw new ORPCError("NOT_FOUND", { message: "No such permit." });
			}
			await context.env.PERMITS.delete(row.r2Key);
			await context.db.delete(permit).where(eq(permit.id, row.id));
			return { ok: true };
		}),
};
