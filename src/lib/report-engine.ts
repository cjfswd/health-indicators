/**
 * Report Engine — Shared data-fetching for PDF/Excel reports
 *
 * Queries the database for a given period and returns a structured
 * payload consumed by both PDF and Excel generators.
 */

import { eq, and, isNull, sql, gte, lte, desc } from "drizzle-orm";
import { db } from "~/db/dev-database";
import {
  patients,
  healthOperators,
  events,
  ledger,
  indicatorDefinitions,
} from "~/db/schema";

export interface ReportData {
  period: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;

  stats: {
    activePatientsCount: number;
    totalPatientsCount: number;
    activeOperatorsCount: number;
    currentEventsCount: number;
    ledgerTotalCount: number;
  };

  modalityBreakdown: { modality: string; count: number; pct: number }[];

  categoryBreakdown: { category: string; label: string; count: number; pct: number }[];

  indicators: {
    code: string;
    name: string;
    currentValue: number;
    targetValue: number | null;
    targetDirection: string | null;
    targetTimeframe: string | null;
    isInformational: boolean;
    status: "within_target" | "outside_target" | "no_data" | "informational";
  }[];

  eventDetails: {
    patientName: string;
    operatorName: string;
    category: string;
    subCategory: string | null;
    occurredAt: string;
    description: string | null;
  }[];

  ledgerEntries: {
    timestamp: string;
    operation: string;
    tableName: string;
    recordId: string;
    performedBy: string;
  }[];
}

function getMonthBoundaries(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + offset + 1,
    0,
    23, 59, 59, 999
  );
  return { start, end };
}

function formatCategoryLabel(cat: string) {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

function formatDateTime(d: Date) {
  return d.toLocaleString("pt-BR");
}

export async function generateReportData(
  period: string = "month"
): Promise<ReportData> {
  const now = new Date();
  let currentStart: Date;
  let currentEnd: Date;
  let periodLabel: string;

  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    currentStart = new Date(now.getFullYear(), q * 3, 1);
    currentEnd = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
    const qNum = q + 1;
    periodLabel = `${qNum}º Trimestre ${now.getFullYear()}`;
  } else if (period === "year") {
    currentStart = new Date(now.getFullYear(), 0, 1);
    currentEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    periodLabel = `Ano ${now.getFullYear()}`;
  } else {
    const { start, end } = getMonthBoundaries(0);
    currentStart = start;
    currentEnd = end;
    periodLabel = now.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    // Capitalize first letter
    periodLabel = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);
  }

  // ── Stats ─────────────────────────────────────────
  const [activePatients, totalPatients, activeOperators, currentEvents, ledgerCount] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(patients)
        .where(and(isNull(patients.deletedAt), eq(patients.active, true))),
      db.select({ count: sql<number>`count(*)` }).from(patients)
        .where(isNull(patients.deletedAt)),
      db.select({ count: sql<number>`count(*)` }).from(healthOperators)
        .where(isNull(healthOperators.deletedAt)),
      db.select({ count: sql<number>`count(*)` }).from(events)
        .where(and(
          isNull(events.deletedAt),
          gte(events.occurredAt, currentStart),
          lte(events.occurredAt, currentEnd),
        )),
      db.select({ count: sql<number>`count(*)` }).from(ledger),
    ]);

  const activePatientsCount = Number(activePatients[0].count);
  const totalPatientsCount = Number(totalPatients[0].count);
  const activeOperatorsCount = Number(activeOperators[0].count);
  const currentEventsCount = Number(currentEvents[0].count);
  const ledgerTotalCount = Number(ledgerCount[0].count);

  // ── Modality ──────────────────────────────────────
  const modalityRows = await db
    .select({ modality: patients.careModality, count: sql<number>`count(*)` })
    .from(patients)
    .where(and(isNull(patients.deletedAt), eq(patients.active, true)))
    .groupBy(patients.careModality);

  const total = activePatientsCount || 1;
  const modalityBreakdown = [
    { modality: "AD", label: "Atenção Domiciliar" },
    { modality: "ID", label: "Internação Domiciliar" },
  ].map((m) => {
    const found = modalityRows.find((r) => r.modality === m.modality);
    const count = found ? Number(found.count) : 0;
    return { modality: m.modality, count, pct: Math.round((count / total) * 100) };
  });

  // ── Category Breakdown ────────────────────────────
  const catRows = await db
    .select({ category: events.category, count: sql<number>`count(*)` })
    .from(events)
    .where(and(
      isNull(events.deletedAt),
      gte(events.occurredAt, currentStart),
      lte(events.occurredAt, currentEnd),
    ))
    .groupBy(events.category);

  const categoryMap: Record<string, number> = {};
  for (const row of catRows) {
    categoryMap[row.category] = Number(row.count);
  }
  const categoryBreakdown = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({
      category: cat,
      label: formatCategoryLabel(cat),
      count,
      pct: Math.round((count / (currentEventsCount || 1)) * 100),
    }));

  // ── Indicators ────────────────────────────────────
  const indRows = await db
    .select()
    .from(indicatorDefinitions)
    .where(and(
      eq(indicatorDefinitions.active, true),
      sql`${indicatorDefinitions.parentId} IS NULL`,
    ))
    .orderBy(indicatorDefinitions.code);

  const indicators = indRows.map((i) => {
    const currentValue = categoryMap[i.eventCategory || ""] || 0;
    const hasTarget = i.targetValue !== null && i.targetValue !== undefined;
    let status: "within_target" | "outside_target" | "no_data" | "informational" = "informational";

    if (i.isInformational) {
      status = "informational";
    } else if (currentValue === 0) {
      status = "no_data";
    } else if (hasTarget) {
      if (i.targetDirection === "higher_is_better") {
        status = currentValue >= (i.targetValue || 0) ? "within_target" : "outside_target";
      } else {
        status = currentValue <= (i.targetValue || 0) ? "within_target" : "outside_target";
      }
    }

    return {
      code: i.code,
      name: i.name,
      currentValue,
      targetValue: i.targetValue,
      targetDirection: i.targetDirection,
      targetTimeframe: i.targetTimeframe,
      isInformational: i.isInformational,
      status,
    };
  });

  // ── Event Details ─────────────────────────────────
  const eventRows = await db
    .select({
      patientName: patients.fullName,
      operatorName: healthOperators.name,
      category: events.category,
      subCategory: events.subCategory,
      occurredAt: events.occurredAt,
      description: events.description,
    })
    .from(events)
    .innerJoin(patients, eq(events.patientId, patients.id))
    .innerJoin(healthOperators, eq(events.operatorId, healthOperators.id))
    .where(and(
      isNull(events.deletedAt),
      gte(events.occurredAt, currentStart),
      lte(events.occurredAt, currentEnd),
    ))
    .orderBy(desc(events.occurredAt))
    .limit(200);

  const eventDetails = eventRows.map((e) => ({
    patientName: e.patientName,
    operatorName: e.operatorName,
    category: formatCategoryLabel(e.category),
    subCategory: e.subCategory ? formatCategoryLabel(e.subCategory) : null,
    occurredAt: formatDate(e.occurredAt),
    description: e.description,
  }));

  // ── Ledger Entries ────────────────────────────────
  const ledgerRows = await db
    .select({
      timestamp: ledger.timestamp,
      operation: ledger.operation,
      tableName: ledger.tableName,
      recordId: ledger.recordId,
      performedBy: ledger.performedBy,
    })
    .from(ledger)
    .orderBy(desc(ledger.timestamp))
    .limit(200);

  const ledgerEntries = ledgerRows.map((l) => ({
    timestamp: formatDateTime(l.timestamp),
    operation: l.operation,
    tableName: l.tableName,
    recordId: l.recordId,
    performedBy: l.performedBy,
  }));

  return {
    period,
    periodLabel,
    periodStart: formatDate(currentStart),
    periodEnd: formatDate(currentEnd),
    generatedAt: formatDateTime(now),
    stats: {
      activePatientsCount,
      totalPatientsCount,
      activeOperatorsCount,
      currentEventsCount,
      ledgerTotalCount,
    },
    modalityBreakdown,
    categoryBreakdown,
    indicators,
    eventDetails,
    ledgerEntries,
  };
}
