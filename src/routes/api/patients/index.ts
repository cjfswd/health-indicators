import type { RequestHandler } from "@builder.io/qwik-city";
import { eq, and, isNull, like, sql, asc, desc } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { patients, healthOperators } from "~/db/schema";
import { InsertPatientSchema } from "~/db/validation";
import { logCreate } from "~/lib/ledger";

/** GET /api/patients — list with filters */
export const onGet: RequestHandler = async ({ json, query }) => {
  const page = parseInt(query.get("page") || "1");
  const pageSize = parseInt(query.get("pageSize") || "20");
  const search = query.get("search") || "";
  const activeFilter = query.get("active");
  const modalityFilter = query.get("careModality");
  const operatorFilter = query.get("operatorId");
  const includeDeleted = query.get("includeDeleted") === "true";
  const sortBy = query.get("sortBy") || "createdAt";
  const sortDir = query.get("sortDir") || "desc";

  const conditions = [];
  if (!includeDeleted) {
    conditions.push(isNull(patients.deletedAt));
  }
  if (search) {
    conditions.push(like(patients.fullName, `%${search}%`));
  }
  if (activeFilter !== null && activeFilter !== undefined && activeFilter !== "") {
    conditions.push(eq(patients.active, activeFilter === "true"));
  }
  if (modalityFilter) {
    conditions.push(eq(patients.careModality, modalityFilter as "AD" | "ID"));
  }
  if (operatorFilter) {
    conditions.push(eq(patients.operatorId, operatorFilter));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderFn = sortDir === "asc" ? asc : desc;
  const orderColumn =
    sortBy === "fullName"
      ? patients.fullName
      : sortBy === "dateOfBirth"
        ? patients.dateOfBirth
        : patients.createdAt;

  const [data, countResult] = await Promise.all([
    db.query.patients.findMany({
      where,
      with: { operator: true },
      orderBy: orderFn(orderColumn),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(patients)
      .where(where),
  ]);

  json(200, {
    data,
    totalCount: Number(countResult[0].count),
    page,
    pageSize,
  });
};

/** POST /api/patients — create */
export const onPost: RequestHandler = async ({ json, parseBody }) => {
  const body = await parseBody();
  const parsed = InsertPatientSchema.safeParse(body);

  if (!parsed.success) {
    json(400, { error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  // Verify operator exists
  const [operator] = await db
    .select()
    .from(healthOperators)
    .where(eq(healthOperators.id, parsed.data.operatorId));

  if (!operator) {
    json(400, { error: "Operadora não encontrada." });
    return;
  }

  const [created] = await db
    .insert(patients)
    .values(parsed.data)
    .returning();

  await logCreate("patients", created as unknown as Record<string, unknown>);

  json(201, { data: created });
};
