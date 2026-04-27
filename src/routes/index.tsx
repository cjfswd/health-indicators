import { component$ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";
import { eq, and, isNull, sql, gte, lte } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { patients, healthOperators, events, ledger, indicatorDefinitions } from "~/db/schema";
import { StatsCard } from "~/components/ui/stats-card";
import { PieChart, type PieChartSegment } from "~/components/ui/pie-chart";
import {
  LuTrendingUp,
  LuActivity,
  LuHeart,
  LuAlertTriangle,
  LuMessageSquare,
  LuSkull,
  LuFileText,
  LuUserCheck,
  LuBug,
  LuArrowUpRight,
  LuArrowDownRight,
  LuDownload,
  LuFileSpreadsheet,
} from "@qwikest/icons/lucide";

// ── Helpers ──────────────────────────────────────────────
function getMonthBoundaries(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

// ── Color config (serializable — no JSX/component references) ──
const CATEGORY_COLORS: Record<string, { color: string; bgColor: string }> = {
  "01": { color: "#10b981", bgColor: "rgba(16,185,129,0.12)" },
  "02": { color: "#f59e0b", bgColor: "rgba(245,158,11,0.12)" },
  "03": { color: "#ef4444", bgColor: "rgba(239,68,68,0.12)" },
  "04": { color: "#6b7280", bgColor: "rgba(107,114,128,0.12)" },
  "05": { color: "#8b5cf6", bgColor: "rgba(139,92,246,0.12)" },
  "06": { color: "#3b82f6", bgColor: "rgba(59,130,246,0.12)" },
  "07": { color: "#f97316", bgColor: "rgba(249,115,22,0.12)" },
  "08": { color: "#dc2626", bgColor: "rgba(220,38,38,0.12)" },
  "09": { color: "#06b6d4", bgColor: "rgba(6,182,212,0.12)" },
};

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const SUB_CATEGORY_LABELS: Record<string, string> = {
  resolvida_domicilio: "Resolvida domicílio",
  remocao_aph: "Remoção APH",
  deterioracao_clinica: "Deterioração clínica",
  nao_aderencia_tratamento: "Não aderência",
  obito_menos_48h: "< 48h",
  obito_mais_48h: "> 48h",
  queda: "Queda",
  broncoaspiracao: "Broncoaspiração",
  lesao_pressao: "Lesão pressão",
  decanulacao: "Decanulação",
  saida_acidental_gtt: "Saída GTT",
  elogio: "Elogio",
  sugestao: "Sugestão",
  reclamacao_solicitacao: "Reclamação",
};

const SUB_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#dc2626"];

// ── Data Loader ──────────────────────────────────────────
export const useDashboardData = routeLoader$(async ({ query }) => {
  const now = new Date();
  const selectedMonth = parseInt(query.get("month") || String(now.getMonth() + 1)) - 1;
  const selectedYear = parseInt(query.get("year") || String(now.getFullYear()));
  const viewPeriod = query.get("viewPeriod") || "month";

  // Calculate period boundaries
  let currentStart: Date, currentEnd: Date, prevStart: Date, prevEnd: Date;
  const monthsMap: Record<string, number> = { month: 1, bimonthly: 2, quarter: 3, quadrimestral: 4, semestral: 6, year: 12 };
  const span = monthsMap[viewPeriod] || 1;

  currentStart = new Date(selectedYear, selectedMonth, 1);
  currentEnd = new Date(selectedYear, selectedMonth + span, 0, 23, 59, 59, 999);
  prevStart = new Date(selectedYear, selectedMonth - span, 1);
  prevEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);

  // ── Stats Cards ──────────────────────────────────────
  const [
    activePatients,
    totalPatients,
    activeOperators,
    currentEvents,
    prevEvents,
    ledgerCount,
  ] = await Promise.all([
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
    db.select({ count: sql<number>`count(*)` }).from(events)
      .where(and(
        isNull(events.deletedAt),
        gte(events.occurredAt, prevStart),
        lte(events.occurredAt, prevEnd),
      )),
    db.select({ count: sql<number>`count(*)` }).from(ledger),
  ]);

  const activePatientsCount = Number(activePatients[0].count);
  const totalPatientsCount = Number(totalPatients[0].count);
  const activeOperatorsCount = Number(activeOperators[0].count);
  const currentEventsCount = Number(currentEvents[0].count);
  const prevEventsCount = Number(prevEvents[0].count);
  const ledgerTotalCount = Number(ledgerCount[0].count);

  // Event trend
  const eventsTrend = prevEventsCount === 0
    ? (currentEventsCount > 0 ? "up" : "neutral")
    : currentEventsCount > prevEventsCount ? "up"
    : currentEventsCount < prevEventsCount ? "down"
    : "neutral";
  const eventsTrendPct = prevEventsCount > 0
    ? Math.round(((currentEventsCount - prevEventsCount) / prevEventsCount) * 100)
    : currentEventsCount > 0 ? 100 : 0;

  // ── Category Breakdown ────────────────────────────────
  const categoryBreakdown = await db
    .select({ category: events.category, count: sql<number>`count(*)` })
    .from(events)
    .where(and(
      isNull(events.deletedAt),
      gte(events.occurredAt, currentStart),
      lte(events.occurredAt, currentEnd),
    ))
    .groupBy(events.category);

  const categoryMap: Record<string, number> = {};
  for (const row of categoryBreakdown) {
    categoryMap[row.category] = Number(row.count);
  }

  // ── Modality Breakdown ─────────────────────────────────
  const modalityBreakdown = await db
    .select({ modality: patients.careModality, count: sql<number>`count(*)` })
    .from(patients)
    .where(and(isNull(patients.deletedAt), eq(patients.active, true)))
    .groupBy(patients.careModality);

  const modalityMap: Record<string, number> = {};
  for (const row of modalityBreakdown) {
    modalityMap[row.modality] = Number(row.count);
  }

  // ── Monthly Trend (last 6 months) ─────────────────────
  const monthlyTrend: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const { start, end } = getMonthBoundaries(-i);
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(and(
        isNull(events.deletedAt),
        gte(events.occurredAt, start),
        lte(events.occurredAt, end),
      ));
    monthlyTrend.push({ month: formatMonth(start), count: Number(result.count) });
  }

  // ── Indicator Definitions ─────────────────────────────
  const indicators = await db
    .select()
    .from(indicatorDefinitions)
    .where(and(
      eq(indicatorDefinitions.active, true),
      sql`${indicatorDefinitions.parentId} IS NULL`,
    ))
    .orderBy(indicatorDefinitions.code);

  // ── Sub-category breakdown for pie charts ─────────────
  const subCategoryBreakdown = await db
    .select({ category: events.category, subCategory: events.subCategory, count: sql<number>`count(*)` })
    .from(events)
    .where(and(
      isNull(events.deletedAt),
      gte(events.occurredAt, currentStart),
      lte(events.occurredAt, currentEnd),
      sql`${events.subCategory} IS NOT NULL`,
    ))
    .groupBy(events.category, events.subCategory);

  const subCatMap: Record<string, { sub: string; count: number }[]> = {};
  for (const row of subCategoryBreakdown) {
    if (!row.subCategory) continue;
    if (!subCatMap[row.category]) subCatMap[row.category] = [];
    subCatMap[row.category].push({ sub: row.subCategory, count: Number(row.count) });
  }

  const viewLabels: Record<string, string> = { month: "Mensal", bimonthly: "Bimestral", quarter: "Trimestral", quadrimestral: "Quadrimestral", semestral: "Semestral", year: "Anual" };

  return {
    stats: {
      activePatientsCount,
      totalPatientsCount,
      activeOperatorsCount,
      currentEventsCount,
      prevEventsCount,
      eventsTrend: eventsTrend as "up" | "down" | "neutral",
      eventsTrendPct,
      ledgerTotalCount,
    },
    categoryMap,
    modalityMap,
    monthlyTrend,
    subCatMap,
    indicators: indicators.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      targetValue: i.targetValue,
      targetDirection: i.targetDirection,
      targetTimeframe: i.targetTimeframe,
      isInformational: i.isInformational,
      eventCategory: i.eventCategory,
      currentValue: categoryMap[i.eventCategory || ""] || 0,
    })),
    selectedMonth: selectedMonth + 1,
    selectedYear,
    viewPeriod,
    periodLabel: viewLabels[viewPeriod] || "Mensal",
  };
});

// ── Icon Helper Component ────────────────────────────────
const IndicatorIcon = component$<{ code: string }>(({ code }) => {
  const style = { width: "20px", height: "20px" };
  switch (code) {
    case "01": return <LuTrendingUp style={style} />;
    case "02": return <LuActivity style={style} />;
    case "03": return <LuHeart style={style} />;
    case "04": return <LuSkull style={style} />;
    case "05": return <LuFileText style={style} />;
    case "06": return <LuUserCheck style={style} />;
    case "07": return <LuBug style={style} />;
    case "08": return <LuAlertTriangle style={style} />;
    case "09": return <LuMessageSquare style={style} />;
    default: return <LuActivity style={style} />;
  }
});

// ── Component ────────────────────────────────────────────
export default component$(() => {
  const data = useDashboardData();
  const { stats, categoryMap, modalityMap, monthlyTrend, subCatMap, indicators, selectedMonth, selectedYear, viewPeriod, periodLabel } = data.value;

  const maxTrendValue = Math.max(...monthlyTrend.map((m) => m.count), 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Build pie chart data for sub-indicators
  const pieSections: { title: string; segments: PieChartSegment[] }[] = [];
  for (const [cat, subs] of Object.entries(subCatMap)) {
    const catLabel = cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const segments: PieChartSegment[] = subs.map((s, i) => ({
      label: SUB_CATEGORY_LABELS[s.sub] || s.sub,
      value: s.count,
      color: SUB_COLORS[i % SUB_COLORS.length],
    }));
    if (segments.length > 0) pieSections.push({ title: catLabel, segments });
  }

  // Build month options based on viewPeriod
  const monthsSpan: Record<string, number> = { month: 1, bimonthly: 2, quarter: 3, quadrimestral: 4, semestral: 6, year: 12 };
  const span = monthsSpan[viewPeriod] || 1;
  const monthIntervals: { value: number; label: string }[] = [];
  if (viewPeriod !== "year") {
    for (let m = 0; m < 12; m += span) {
      if (span === 1) {
        monthIntervals.push({ value: m + 1, label: MONTH_NAMES[m] });
      } else {
        const endM = Math.min(m + span - 1, 11);
        monthIntervals.push({
          value: m + 1,
          label: `${MONTH_NAMES[m].substring(0, 3)} – ${MONTH_NAMES[endM].substring(0, 3)}`,
        });
      }
    }
  }

  return (
    <div class="space-y-6">
      {/* Page Header + Period Selectors */}
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 class="m-0 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
            <p class="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Visão geral dos indicadores de saúde domiciliar</p>
          </div>
          {/* Month + Year Selectors */}
          <div class="flex items-center gap-2">
            {viewPeriod !== "year" && (
              <select
                class="input select"
                style={{ width: "auto" }}
                value={String(selectedMonth)}
                onChange$={(e) => {
                  const m = (e.target as HTMLSelectElement).value;
                  window.location.href = `?month=${m}&year=${selectedYear}&viewPeriod=${viewPeriod}`;
                }}
              >
                {monthIntervals.map((mi) => (
                  <option key={mi.value} value={String(mi.value)}>{mi.label}</option>
                ))}
              </select>
            )}
            <select
              class="input select"
              style={{ width: "auto" }}
              value={String(selectedYear)}
              onChange$={(e) => {
                const y = (e.target as HTMLSelectElement).value;
                window.location.href = `?month=${selectedMonth}&year=${y}&viewPeriod=${viewPeriod}`;
              }}
            >
              {years.map((y) => (<option key={y} value={String(y)}>{y}</option>))}
            </select>
          </div>
        </div>
        {/* View Period Toggles */}
        <div class="flex flex-wrap items-center gap-2">
          {(["month","bimonthly","quarter","quadrimestral","semestral","year"] as const).map((p) => {
            const labels: Record<string, string> = { month: "Mensal", bimonthly: "Bimestral", quarter: "Trimestral", quadrimestral: "Quadrimestral", semestral: "Semestral", year: "Anual" };
            // Snap month to nearest valid interval when switching period
            const pSpan = monthsSpan[p] || 1;
            const snappedMonth = p === "year" ? 1 : Math.floor((selectedMonth - 1) / pSpan) * pSpan + 1;
            return (
              <a key={p} href={`?month=${snappedMonth}&year=${selectedYear}&viewPeriod=${p}`}
                class={`btn btn-sm ${viewPeriod === p ? "btn-primary" : "btn-secondary"}`}
              >
                {labels[p]}
              </a>
            );
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Pacientes Ativos"
          value={stats.activePatientsCount}
          iconName="users"
          subtitle={`${stats.totalPatientsCount} total cadastrado${stats.totalPatientsCount !== 1 ? "s" : ""}`}
        />
        <StatsCard
          label="Operadoras"
          value={stats.activeOperatorsCount}
          iconName="building"
          subtitle="ativas no sistema"
        />
        <StatsCard
          label={`Eventos (${periodLabel})`}
          value={stats.currentEventsCount}
          iconName="calendar"
          trend={stats.eventsTrend}
          trendValue={`${stats.eventsTrendPct >= 0 ? "+" : ""}${stats.eventsTrendPct}%`}
          subtitle="vs período anterior"
        />
        <StatsCard
          label="Registros Auditados"
          value={stats.ledgerTotalCount}
          iconName="shield"
          subtitle="operações rastreadas"
        />
      </div>

      {/* Two-Column Layout: Trend Chart + Modality Breakdown */}
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Monthly Trend */}
        <div class="card p-5 lg:col-span-2">
          <h3 class="m-0 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Eventos — Últimos 6 meses
          </h3>
          <div class="mt-4 flex items-end gap-2" style={{ height: "120px" }}>
            {monthlyTrend.map((m, idx) => (
              <div key={idx} class="flex flex-1 flex-col items-center gap-1">
                <span class="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  {m.count}
                </span>
                <div
                  class="w-full rounded-t-md"
                  style={{
                    height: `${Math.max((m.count / maxTrendValue) * 100, 4)}%`,
                    background: idx === monthlyTrend.length - 1
                      ? "var(--color-primary-500)"
                      : "var(--bg-active)",
                    transition: "height 0.5s ease",
                    minHeight: "4px",
                  }}
                />
                <span class="text-[10px] uppercase" style={{ color: "var(--text-tertiary)" }}>
                  {m.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Modality Breakdown */}
        <div class="card p-5">
          <h3 class="m-0 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Modalidade de Atendimento
          </h3>
          <div class="mt-4 space-y-4">
            {[
              { key: "AD", label: "Atenção Domiciliar", color: "var(--color-primary-500)" },
              { key: "ID", label: "Internação Domiciliar", color: "#f59e0b" },
            ].map((mod) => {
              const val = modalityMap[mod.key] || 0;
              const total = stats.activePatientsCount || 1;
              const pct = Math.round((val / total) * 100);
              return (
                <div key={mod.key}>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {mod.key}
                    </span>
                    <span class="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {val} ({pct}%)
                    </span>
                  </div>
                  <div class="rounded-full" style={{ height: "8px", background: "var(--bg-hover)", overflow: "hidden" }}>
                    <div
                      class="rounded-full"
                      style={{ width: `${pct}%`, height: "100%", background: mod.color, transition: "width 0.6s ease" }}
                    />
                  </div>
                  <p class="m-0 mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {mod.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Indicators Grid */}
      <div>
        <h2 class="m-0 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Indicadores de Desempenho
        </h2>
        <p class="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Calculados automaticamente a partir dos eventos do período ({periodLabel.toLowerCase()})
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {indicators.map((ind) => {
          const colors = CATEGORY_COLORS[ind.code] || { color: "#6b7280", bgColor: "rgba(107,114,128,0.12)" };
          const hasTarget = ind.targetValue !== null && ind.targetValue !== undefined;
          const progressPct = hasTarget
            ? Math.min(Math.round((ind.currentValue / (ind.targetValue || 1)) * 100), 100)
            : 0;

          let targetStatus: "good" | "bad" | "neutral" = "neutral";
          if (hasTarget && ind.currentValue > 0) {
            if (ind.targetDirection === "higher_is_better") {
              targetStatus = ind.currentValue >= (ind.targetValue || 0) ? "good" : "bad";
            } else {
              targetStatus = ind.currentValue <= (ind.targetValue || 0) ? "good" : "bad";
            }
          }

          return (
            <div key={ind.code} class="card px-5 py-4 animate-slide-up">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                  <div
                    class="flex items-center justify-center rounded-lg"
                    style={{ width: "36px", height: "36px", background: colors.bgColor, color: colors.color }}
                  >
                    <IndicatorIcon code={ind.code} />
                  </div>
                  <span
                    class="text-xs font-bold"
                    style={{
                      color: colors.color,
                      background: colors.bgColor,
                      padding: "2px 8px",
                      borderRadius: "var(--radius-full)",
                    }}
                  >
                    {ind.code}
                  </span>
                </div>
                <span class="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {ind.currentValue}
                </span>
              </div>

              <h3 class="m-0 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {ind.name}
              </h3>

              <div class="mt-2 flex items-center justify-between">
                <p class="m-0 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {hasTarget
                    ? `Meta: ${ind.targetDirection === "lower_is_better" ? "≤" : "≥"} ${ind.targetValue}% (${
                        ind.targetTimeframe === "monthly" ? "mensal"
                        : ind.targetTimeframe === "quarterly" ? "trimestral"
                        : ind.targetTimeframe || "—"
                      })`
                    : "Informacional"}
                </p>
                {hasTarget && ind.currentValue > 0 && (
                  <span
                    class="flex items-center gap-1 text-xs font-medium"
                    style={{ color: targetStatus === "good" ? "var(--color-success)" : "var(--color-danger)" }}
                  >
                    {targetStatus === "good"
                      ? <LuArrowUpRight style={{ width: "12px", height: "12px" }} />
                      : <LuArrowDownRight style={{ width: "12px", height: "12px" }} />
                    }
                    {targetStatus === "good" ? "Dentro da meta" : "Fora da meta"}
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div class="mt-3 rounded-md" style={{ height: "6px", background: "var(--bg-hover)", overflow: "hidden" }}>
                <div
                  style={{
                    width: hasTarget ? `${progressPct}%` : ind.currentValue > 0 ? "100%" : "0%",
                    height: "100%",
                    background: hasTarget
                      ? (targetStatus === "good" ? "var(--color-success)" : targetStatus === "bad" ? "var(--color-danger)" : colors.color)
                      : colors.color,
                    borderRadius: "inherit",
                    transition: "width 0.6s ease",
                    opacity: ind.currentValue > 0 ? 1 : 0.3,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Category Breakdown Table */}
      {Object.keys(categoryMap).length > 0 && (
        <div class="card p-5">
          <h3 class="m-0 text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Eventos por Categoria ({periodLabel})
          </h3>
          <div class="space-y-3">
            {Object.entries(categoryMap)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, catCount]) => {
                const totalEvents = stats.currentEventsCount || 1;
                const pct = Math.round((catCount / totalEvents) * 100);
                const label = cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <div key={cat}>
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-sm" style={{ color: "var(--text-primary)" }}>{label}</span>
                      <span class="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        {catCount} ({pct}%)
                      </span>
                    </div>
                    <div class="rounded-full" style={{ height: "6px", background: "var(--bg-hover)", overflow: "hidden" }}>
                      <div
                        class="rounded-full"
                        style={{ width: `${pct}%`, height: "100%", background: "var(--color-primary-500)", transition: "width 0.6s ease" }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Sub-Indicator Pie Charts */}
      {pieSections.length > 0 && (
        <div>
          <h2 class="m-0 text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Detalhamento por Subcategoria
          </h2>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pieSections.map((section) => (
              <div key={section.title} class="card p-4 flex items-center justify-center">
                <PieChart
                  segments={section.segments}
                  title={section.title}
                  size={120}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Card */}
      <div
        class="card p-5"
        style={{
          background: "linear-gradient(135deg, var(--bg-active), var(--bg-card))",
          borderColor: "var(--color-primary-200)",
        }}
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="m-0 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              📊 Exportar Relatório C-Level
            </h3>
            <p class="m-0 mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Gere um relatório completo com indicadores, eventos e auditoria ({periodLabel.toLowerCase()})
            </p>
          </div>
          <div class="flex items-center gap-3">
            <a
              href={`/api/reports/pdf?period=${viewPeriod}`}
              class="btn btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none" }}
              download
            >
              <LuDownload style={{ width: "16px", height: "16px" }} />
              Baixar PDF
            </a>
            <a
              href={`/api/reports/excel?period=${viewPeriod}`}
              class="btn btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none" }}
              download
            >
              <LuFileSpreadsheet style={{ width: "16px", height: "16px" }} />
              Baixar Excel
            </a>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Dashboard — HealthPanel",
  meta: [{ name: "description", content: "Visão geral dos indicadores de saúde domiciliar para relatórios C-level." }],
};
