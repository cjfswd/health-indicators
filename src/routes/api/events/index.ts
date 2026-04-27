import type { RequestHandler } from "@builder.io/qwik-city";
import { eq, and, isNull, sql, asc, desc, gte, lte } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { events, patients, healthOperators } from "~/db/schema";
import { InsertEventSchema } from "~/db/validation";
import { logCreate } from "~/lib/ledger";

/** GET /api/events — list with filters */
export const onGet: RequestHandler = async ({ json, query }) => {
  const page = parseInt(query.get("page") || "1");
  const pageSize = parseInt(query.get("pageSize") || "20");
  const patientId = query.get("patientId");
  const operatorId = query.get("operatorId");
  const category = query.get("category");
  const subCategory = query.get("subCategory");
  const startDate = query.get("startDate");
  const endDate = query.get("endDate");
  const includeDeleted = query.get("includeDeleted") === "true";
  const sortDir = query.get("sortDir") || "desc";

  const conditions = [];
  if (!includeDeleted) {
    conditions.push(isNull(events.deletedAt));
  }
  if (patientId) {
    conditions.push(eq(events.patientId, patientId));
  }
  if (operatorId) {
    conditions.push(eq(events.operatorId, operatorId));
  }
  if (category) {
    conditions.push(eq(events.category, category as any));
  }
  if (subCategory) {
    conditions.push(eq(events.subCategory, subCategory as any));
  }
  if (startDate) {
    conditions.push(gte(events.occurredAt, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(events.occurredAt, new Date(endDate)));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const orderFn = sortDir === "asc" ? asc : desc;

  const [data, countResult] = await Promise.all([
    db.query.events.findMany({
      where,
      with: {
        patient: true,
        operator: true,
      },
      orderBy: orderFn(events.occurredAt),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(where),
  ]);

  json(200, {
    data,
    totalCount: Number(countResult[0].count),
    page,
    pageSize,
  });
};

/** POST /api/events — create */
export const onPost: RequestHandler = async ({ json, parseBody }) => {
  const body = await parseBody();
  const parsed = InsertEventSchema.safeParse(body);

  if (!parsed.success) {
    json(400, { error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  // Verify patient exists
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, parsed.data.patientId));

  if (!patient) {
    json(400, { error: "Paciente não encontrado." });
    return;
  }

  const [created] = await db
    .insert(events)
    .values(parsed.data)
    .returning();

  await logCreate("events", created as unknown as Record<string, unknown>);

  json(201, { data: created });
};
