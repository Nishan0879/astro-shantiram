import { and, count, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { contactMessages, contactStatuses } from "../db/schema.js";

const PAGE_SIZE = 20;

const listQuery = z.object({
  status: z.enum(contactStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const idParam = z.uuid();
const updateSchema = z.object({ status: z.enum(contactStatuses) });

/** Contact messages for the admin dashboard; mount behind requireAuth. */
export function adminMessagesRouter({ db }: { db: Database }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const { status, page } = parsed.data;
    const where = status ? eq(contactMessages.status, status) : undefined;

    const [messages, byStatus] = await Promise.all([
      db
        .select()
        .from(contactMessages)
        .where(where)
        .orderBy(desc(contactMessages.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      db
        .select({ status: contactMessages.status, total: count() })
        .from(contactMessages)
        .groupBy(contactMessages.status),
    ]);

    const counts = Object.fromEntries(contactStatuses.map((s) => [s, 0])) as Record<string, number>;
    for (const row of byStatus) counts[row.status] = row.total;
    const total = status ? counts[status] : byStatus.reduce((sum, r) => sum + r.total, 0);

    res.json({ messages, counts, total, page, pageSize: PAGE_SIZE });
  });

  router.get("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    // Opening a new message marks it read
    await db
      .update(contactMessages)
      .set({ status: "read" })
      .where(and(eq(contactMessages.id, id.data), eq(contactMessages.status, "new")));
    const [message] = await db.select().from(contactMessages).where(eq(contactMessages.id, id.data));
    if (!message) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ message });
  });

  router.patch("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const body = updateSchema.safeParse(req.body);
    if (!id.success || !body.success) {
      res.status(id.success ? 400 : 404).json({ error: id.success ? "validation_failed" : "not_found" });
      return;
    }
    const [message] = await db
      .update(contactMessages)
      .set({ status: body.data.status })
      .where(eq(contactMessages.id, id.data))
      .returning();
    if (!message) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ message });
  });

  router.delete("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const deleted = id.success
      ? await db.delete(contactMessages).where(eq(contactMessages.id, id.data)).returning({ id: contactMessages.id })
      : [];
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
