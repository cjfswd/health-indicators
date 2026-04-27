import type { RequestHandler } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { patients } from "~/db/schema";
import { UpdatePatientSchema } from "~/db/validation";
import { logUpdate, logDelete, logRestore } from "~/lib/ledger";

/** GET /api/patients/:id */
export const onGet: RequestHandler = async ({ json, params }) => {
  const { id } = params;

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, id),
    with: { operator: true, events: true },
  });

  if (!patient) {
    json(404, { error: "Paciente não encontrado." });
    return;
  }

  json(200, { data: patient });
};

/** PUT /api/patients/:id */
export const onPut: RequestHandler = async ({ json, params, parseBody }) => {
  const { id } = params;
  const body = await parseBody();
  const parsed = UpdatePatientSchema.safeParse(body);

  if (!parsed.success) {
    json(400, { error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  const [existing] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, id));

  if (!existing) {
    json(404, { error: "Paciente não encontrado." });
    return;
  }

  const [updated] = await db
    .update(patients)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(patients.id, id))
    .returning();

  await logUpdate(
    "patients",
    id,
    existing as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>
  );

  json(200, { data: updated });
};

/** DELETE /api/patients/:id — soft delete */
export const onDelete: RequestHandler = async ({ json, params }) => {
  const { id } = params;

  const [existing] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, id));

  if (!existing) {
    json(404, { error: "Paciente não encontrado." });
    return;
  }

  if (existing.deletedAt) {
    json(400, { error: "Paciente já foi removido." });
    return;
  }

  await db
    .update(patients)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(patients.id, id));

  await logDelete("patients", id, existing as unknown as Record<string, unknown>);

  json(200, { message: "Paciente removido com sucesso." });
};

/** PATCH /api/patients/:id — toggle active or restore */
export const onPatch: RequestHandler = async ({ json, params, query }) => {
  const { id } = params;
  const action = query.get("action");

  const [existing] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, id));

  if (!existing) {
    json(404, { error: "Paciente não encontrado." });
    return;
  }

  if (action === "toggle-active") {
    const [updated] = await db
      .update(patients)
      .set({ active: !existing.active, updatedAt: new Date() })
      .where(eq(patients.id, id))
      .returning();

    await logUpdate(
      "patients",
      id,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>
    );

    json(200, { data: updated });
    return;
  }

  if (action === "restore") {
    if (!existing.deletedAt) {
      json(400, { error: "Paciente não está removido." });
      return;
    }

    const [restored] = await db
      .update(patients)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(patients.id, id))
      .returning();

    await logRestore(
      "patients",
      id,
      existing as unknown as Record<string, unknown>,
      restored as unknown as Record<string, unknown>
    );

    json(200, { data: restored });
    return;
  }

  json(400, { error: "Ação inválida. Use ?action=toggle-active ou ?action=restore" });
};
