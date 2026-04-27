import type { RequestHandler } from "@builder.io/qwik-city";
import { eq, and, isNull, like, sql, desc, asc } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { healthOperators } from "~/db/schema";
import { InsertHealthOperatorSchema } from "~/db/validation";
import { logCreate } from "~/lib/ledger";

/** GET /api/health-operators — list all operators */
export const onGet: RequestHandler = async ({ json, query }) => {
  const page = parseInt(query.get("page") || "1");
  const pageSize = parseInt(query.get("pageSize") || "20");
  const search = query.get("search") || "";
  const includeDeleted = query.get("includeDeleted") === "true";

  const conditions = [];
  if (!includeDeleted) {
    conditions.push(isNull(healthOperators.deletedAt));
  }
  if (search) {
    conditions.push(like(healthOperators.name, `%${search}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(healthOperators)
      .where(where)
      .orderBy(asc(healthOperators.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)` })
      .from(healthOperators)
      .where(where),
  ]);

  json(200, {
    data,
    totalCount: Number(countResult[0].count),
    page,
    pageSize,
  });
};

/** POST /api/health-operators — create a new operator */
export const onPost: RequestHandler = async ({ json, parseBody }) => {
  const body = await parseBody();
  const parsed = InsertHealthOperatorSchema.safeParse(body);

  if (!parsed.success) {
    json(400, { error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  try {
    const [created] = await db
      .insert(healthOperators)
      .values(parsed.data)
      .returning();

    await logCreate("health_operators", created as unknown as Record<string, unknown>);

    json(201, { data: created });
  } catch (error: any) {
    if (error.message?.includes("unique")) {
      json(409, { error: "Operadora com este nome já existe." });
    } else {
      json(500, { error: "Erro interno ao criar operadora." });
    }
  }
};
