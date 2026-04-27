import type { RequestHandler } from "@builder.io/qwik-city";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { ledger } from "~/db/schema";

/** GET /api/ledger — read-only audit log */
export const onGet: RequestHandler = async ({ json, query }) => {
  const page = parseInt(query.get("page") || "1");
  const pageSize = parseInt(query.get("pageSize") || "20");
  const tableName = query.get("tableName");
  const recordId = query.get("recordId");
  const operation = query.get("operation");
  const performedBy = query.get("performedBy");
  const startDate = query.get("startDate");
  const endDate = query.get("endDate");

  const conditions = [];
  if (tableName) {
    conditions.push(eq(ledger.tableName, tableName));
  }
  if (recordId) {
    conditions.push(eq(ledger.recordId, recordId));
  }
  if (operation) {
    conditions.push(eq(ledger.operation, operation as any));
  }
  if (performedBy) {
    conditions.push(eq(ledger.performedBy, performedBy));
  }
  if (startDate) {
    conditions.push(gte(ledger.timestamp, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(ledger.timestamp, new Date(endDate)));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(ledger)
      .where(where)
      .orderBy(desc(ledger.timestamp))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)` })
      .from(ledger)
      .where(where),
  ]);

  json(200, {
    data,
    totalCount: Number(countResult[0].count),
    page,
    pageSize,
  });
};
