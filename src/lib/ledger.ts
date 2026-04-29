/**
 * Centralized Ledger Helper
 *
 * Provides functions to log every mutation to the append-only
 * audit ledger. All CRUD operations must call these functions
 * to maintain complete auditability.
 */

import { db } from "~/db/dev-database";
import { ledger } from "~/db/schema";

const DEFAULT_USER = "sistema@Health Indicators.local";

export async function logCreate(
  tableName: string,
  record: Record<string, unknown>,
  performedBy: string = DEFAULT_USER
) {
  await db.insert(ledger).values({
    tableName,
    recordId: record.id as string,
    operation: "CREATE",
    performedBy,
    previousState: null,
    newState: record,
  });
}

export async function logUpdate(
  tableName: string,
  recordId: string,
  previousState: Record<string, unknown>,
  newState: Record<string, unknown>,
  performedBy: string = DEFAULT_USER
) {
  await db.insert(ledger).values({
    tableName,
    recordId,
    operation: "UPDATE",
    performedBy,
    previousState,
    newState,
  });
}

export async function logDelete(
  tableName: string,
  recordId: string,
  previousState: Record<string, unknown>,
  performedBy: string = DEFAULT_USER
) {
  await db.insert(ledger).values({
    tableName,
    recordId,
    operation: "DELETE",
    performedBy,
    previousState,
    newState: { ...previousState, deletedAt: new Date().toISOString() },
  });
}

export async function logRestore(
  tableName: string,
  recordId: string,
  previousState: Record<string, unknown>,
  newState: Record<string, unknown>,
  performedBy: string = DEFAULT_USER
) {
  await db.insert(ledger).values({
    tableName,
    recordId,
    operation: "RESTORE",
    performedBy,
    previousState,
    newState,
  });
}

export async function logCompensate(
  tableName: string,
  recordId: string,
  previousState: Record<string, unknown>,
  newState: Record<string, unknown>,
  performedBy: string = DEFAULT_USER
) {
  await db.insert(ledger).values({
    tableName,
    recordId,
    operation: "COMPENSATE",
    performedBy,
    previousState,
    newState,
  });
}
