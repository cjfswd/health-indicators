import type { RequestHandler } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { events } from "~/db/schema";
import { UpdateEventSchema } from "~/db/validation";
import { logUpdate, logDelete } from "~/lib/ledger";

/** GET /api/events/:id */
export const onGet: RequestHandler = async ({ json, params }) => {
  const { id } = params;

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
    with: { patient: true, operator: true },
  });

  if (!event) {
    json(404, { error: "Evento não encontrado." });
    return;
  }

  json(200, { data: event });
};

/** PUT /api/events/:id */
export const onPut: RequestHandler = async ({ json, params, parseBody }) => {
  const { id } = params;
  const body = await parseBody();
  const parsed = UpdateEventSchema.safeParse(body);

  if (!parsed.success) {
    json(400, { error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  const [existing] = await db
    .select()
    .from(events)
    .where(eq(events.id, id));

  if (!existing) {
    json(404, { error: "Evento não encontrado." });
    return;
  }

  const [updated] = await db
    .update(events)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();

  await logUpdate(
    "events",
    id,
    existing as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>
  );

  json(200, { data: updated });
};

/** DELETE /api/events/:id — soft delete */
export const onDelete: RequestHandler = async ({ json, params }) => {
  const { id } = params;

  const [existing] = await db
    .select()
    .from(events)
    .where(eq(events.id, id));

  if (!existing) {
    json(404, { error: "Evento não encontrado." });
    return;
  }

  if (existing.deletedAt) {
    json(400, { error: "Evento já foi removido." });
    return;
  }

  await db
    .update(events)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(events.id, id));

  await logDelete("events", id, existing as unknown as Record<string, unknown>);

  json(200, { message: "Evento removido com sucesso." });
};
