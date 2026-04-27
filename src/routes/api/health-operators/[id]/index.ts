import type { RequestHandler } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { healthOperators } from "~/db/schema";
import { UpdateHealthOperatorSchema } from "~/db/validation";
import { logUpdate, logDelete, logRestore } from "~/lib/ledger";

/** GET /api/health-operators/:id */
export const onGet: RequestHandler = async ({ json, params }) => {
  const { id } = params;

  const [operator] = await db
    .select()
    .from(healthOperators)
    .where(eq(healthOperators.id, id));

  if (!operator) {
    json(404, { error: "Operadora não encontrada." });
    return;
  }

  json(200, { data: operator });
};

/** PUT /api/health-operators/:id */
export const onPut: RequestHandler = async ({ json, params, parseBody }) => {
  const { id } = params;
  const body = await parseBody();
  const parsed = UpdateHealthOperatorSchema.safeParse(body);

  if (!parsed.success) {
    json(400, { error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  const [existing] = await db
    .select()
    .from(healthOperators)
    .where(eq(healthOperators.id, id));

  if (!existing) {
    json(404, { error: "Operadora não encontrada." });
    return;
  }

  const [updated] = await db
    .update(healthOperators)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(healthOperators.id, id))
    .returning();

  await logUpdate(
    "health_operators",
    id,
    existing as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>
  );

  json(200, { data: updated });
};

/** DELETE /api/health-operators/:id — soft delete */
export const onDelete: RequestHandler = async ({ json, params }) => {
  const { id } = params;

  const [existing] = await db
    .select()
    .from(healthOperators)
    .where(eq(healthOperators.id, id));

  if (!existing) {
    json(404, { error: "Operadora não encontrada." });
    return;
  }

  if (existing.deletedAt) {
    json(400, { error: "Operadora já foi removida." });
    return;
  }

  await db
    .update(healthOperators)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(healthOperators.id, id));

  await logDelete("health_operators", id, existing as unknown as Record<string, unknown>);

  json(200, { message: "Operadora removida com sucesso." });
};
