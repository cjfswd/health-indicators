import { component$, useSignal, useStore, $ } from "@builder.io/qwik";
import {
  type DocumentHead,
  routeLoader$,
  routeAction$,
  zod$,
  z,
} from "@builder.io/qwik-city";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { ledger, healthOperators, patients, events } from "~/db/schema";
import { logCompensate } from "~/lib/ledger";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { ToastContainer, createToast, type ToastData } from "~/components/ui/toast";
import {
  LuShieldCheck,
  LuChevronLeft,
  LuChevronRight,
  LuUndo2,
  LuChevronDown,
} from "@qwikest/icons/lucide";

const OP_LABELS: Record<string, string> = {
  CREATE: "Criação",
  UPDATE: "Atualização",
  DELETE: "Remoção",
  RESTORE: "Restauração",
  COMPENSATE: "Compensação",
};

const OP_COLORS: Record<string, { bg: string; text: string }> = {
  CREATE: { bg: "rgba(16,185,129,0.15)", text: "#10b981" },
  UPDATE: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
  DELETE: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
  RESTORE: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  COMPENSATE: { bg: "rgba(107,114,128,0.15)", text: "#6b7280" },
};

const TABLE_LABELS: Record<string, string> = {
  health_operators: "Operadoras",
  patients: "Pacientes",
  events: "Eventos",
  indicator_definitions: "Indicadores",
  indicator_records: "Registros KPI",
};

const FIELD_LABELS: Record<string, string> = {
  id: "ID",
  full_name: "Nome Completo", fullName: "Nome Completo",
  date_of_birth: "Data de Nascimento", dateOfBirth: "Data de Nascimento",
  gender: "Sexo",
  care_modality: "Modalidade", careModality: "Modalidade",
  operator_id: "Operadora ID", operatorId: "Operadora ID",
  active: "Ativo", name: "Nome",
  category: "Categoria",
  sub_category: "Subcategoria", subCategory: "Subcategoria",
  occurred_at: "Data do Evento", occurredAt: "Data do Evento",
  description: "Descrição",
  patient_id: "Paciente ID", patientId: "Paciente ID",
  created_at: "Criado em", createdAt: "Criado em",
  updated_at: "Atualizado em", updatedAt: "Atualizado em",
  deleted_at: "Removido em", deletedAt: "Removido em",
  admission_date: "Data de Admissão", admissionDate: "Data de Admissão",
  attachments: "Anexos", metadata: "Metadados",
  performed_by: "Realizado por",
  target_value: "Meta", targetValue: "Meta", code: "Código",
};

// Drizzle table references by name
const TABLE_MAP: Record<string, any> = {
  health_operators: healthOperators,
  patients: patients,
  events: events,
};

function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try { return new Date(value).toLocaleString("pt-BR"); } catch { return value; }
  }
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function computeDiff(
  operation: string,
  oldState: Record<string, any> | null,
  newState: Record<string, any> | null
): { field: string; label: string; oldVal: string; newVal: string; type: "added" | "removed" | "changed" | "unchanged" }[] {
  const diff: { field: string; label: string; oldVal: string; newVal: string; type: "added" | "removed" | "changed" | "unchanged" }[] = [];
  const SKIP_FIELDS = new Set(["attachments", "metadata"]);

  if (operation === "CREATE" && newState) {
    for (const [key, val] of Object.entries(newState)) {
      if (SKIP_FIELDS.has(key)) continue;
      diff.push({ field: key, label: FIELD_LABELS[key] || key, oldVal: "", newVal: formatFieldValue(val), type: "added" });
    }
    return diff;
  }
  if (operation === "DELETE" && oldState) {
    for (const [key, val] of Object.entries(oldState)) {
      if (SKIP_FIELDS.has(key)) continue;
      diff.push({ field: key, label: FIELD_LABELS[key] || key, oldVal: formatFieldValue(val), newVal: "— removido —", type: "removed" });
    }
    return diff;
  }
  if ((operation === "UPDATE" || operation === "RESTORE") && oldState && newState) {
    const allKeys = new Set([...Object.keys(oldState), ...Object.keys(newState)]);
    for (const key of allKeys) {
      if (SKIP_FIELDS.has(key)) continue;
      const oldVal = formatFieldValue(oldState[key]);
      const newVal = formatFieldValue(newState[key]);
      if (oldVal !== newVal) {
        diff.push({ field: key, label: FIELD_LABELS[key] || key, oldVal, newVal, type: "changed" });
      }
    }
    return diff;
  }
  if (newState) {
    for (const [key, val] of Object.entries(newState)) {
      if (SKIP_FIELDS.has(key)) continue;
      diff.push({ field: key, label: FIELD_LABELS[key] || key, oldVal: "", newVal: formatFieldValue(val), type: "unchanged" });
    }
  }
  return diff;
}

/**
 * Determine if a ledger entry can be safely reversed.
 * Rules:
 * - COMPENSATE entries cannot be reversed (they ARE reversals)
 * - An entry can only be reversed if it's the LATEST operation on that record
 *   (no subsequent ledger entries exist for the same record_id + table)
 * - CREATE can only be reversed if the record still exists and hasn't been modified
 * - DELETE can be reversed (re-create / restore from previous state)
 * - UPDATE can be reversed (restore previous state)
 * - RESTORE can be reversed (re-soft-delete)
 */
function canReverse(entry: any, latestOpMap: Record<string, string>): { allowed: boolean; reason: string } {
  if (entry.operation === "COMPENSATE") {
    return { allowed: false, reason: "Compensações não podem ser revertidas" };
  }
  const key = `${entry.tableName}::${entry.recordId}`;
  const latestId = latestOpMap[key];
  if (latestId !== entry.id) {
    return { allowed: false, reason: "Operações posteriores existem neste registro" };
  }
  if (!TABLE_MAP[entry.tableName]) {
    return { allowed: false, reason: "Tabela não suportada para reversão" };
  }
  return { allowed: true, reason: "" };
}

// ── Data Loader ──────────────────────────────────────────
export const useLedger = routeLoader$(async ({ query }) => {
  const page = parseInt(query.get("page") || "1");
  const pageSize = parseInt(query.get("pageSize") || "20");
  const tableName = query.get("tableName");
  const operation = query.get("operation");
  const startDate = query.get("startDate");
  const endDate = query.get("endDate");

  const conditions = [];
  if (tableName) conditions.push(eq(ledger.tableName, tableName));
  if (operation) conditions.push(eq(ledger.operation, operation as any));
  if (startDate) conditions.push(gte(ledger.timestamp, new Date(startDate)));
  if (endDate) conditions.push(lte(ledger.timestamp, new Date(endDate)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select().from(ledger).where(where).orderBy(desc(ledger.timestamp)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(ledger).where(where),
  ]);

  // For each record in the page, find the latest ledger entry to determine reversibility
  const recordKeys = new Set(data.map((d) => `${d.tableName}::${d.recordId}`));
  const latestOpMap: Record<string, string> = {};

  for (const key of recordKeys) {
    const [tbl, recId] = key.split("::");
    const [latest] = await db
      .select({ id: ledger.id })
      .from(ledger)
      .where(and(eq(ledger.tableName, tbl), eq(ledger.recordId, recId)))
      .orderBy(desc(ledger.timestamp))
      .limit(1);
    if (latest) latestOpMap[key] = latest.id;
  }

  return {
    data: data.map((d) => {
      const entry = { ...d, timestamp: d.timestamp.toISOString() };
      const rev = canReverse(entry, latestOpMap);
      return { ...entry, canReverse: rev.allowed, reverseReason: rev.reason };
    }),
    totalCount: Number(countResult[0].count),
    page,
    pageSize,
  };
});

// ── Reversal Action ──────────────────────────────────────
export const useReverseLedgerEntry = routeAction$(
  async (data) => {
    // 1. Find the ledger entry
    const [entry] = await db.select().from(ledger).where(eq(ledger.id, data.entryId));
    if (!entry) return { success: false, message: "Registro de auditoria não encontrado." };

    const table = TABLE_MAP[entry.tableName];
    if (!table) return { success: false, message: "Tabela não suportada para reversão." };

    // 2. Verify this is still the latest operation (prevent race conditions)
    const [latest] = await db
      .select({ id: ledger.id })
      .from(ledger)
      .where(and(eq(ledger.tableName, entry.tableName), eq(ledger.recordId, entry.recordId)))
      .orderBy(desc(ledger.timestamp))
      .limit(1);

    if (latest?.id !== entry.id) {
      return { success: false, message: "Operações posteriores existem. Não é possível reverter com segurança." };
    }

    if (entry.operation === "COMPENSATE") {
      return { success: false, message: "Compensações não podem ser revertidas." };
    }

    try {
      const prevState = entry.previousState as Record<string, any> | null;
      const newState = entry.newState as Record<string, any> | null;

      if (entry.operation === "CREATE") {
        // Reverse of CREATE = soft delete (or hard delete if no deletedAt column)
        const [current] = await db.select().from(table).where(eq(table.id, entry.recordId));
        if (!current) return { success: false, message: "Registro já foi removido." };

        await db.update(table).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(table.id, entry.recordId));
        await logCompensate(entry.tableName, entry.recordId, current as any, { ...current, deletedAt: new Date().toISOString() } as any);
        return { success: true, message: "Criação revertida — registro marcado como removido." };
      }

      if (entry.operation === "DELETE") {
        // Reverse of DELETE = restore previous state (un-soft-delete)
        if (!prevState) return { success: false, message: "Estado anterior não disponível." };

        const [current] = await db.select().from(table).where(eq(table.id, entry.recordId));
        if (!current) return { success: false, message: "Registro não encontrado." };

        await db.update(table).set({ deletedAt: null, updatedAt: new Date() }).where(eq(table.id, entry.recordId));
        await logCompensate(entry.tableName, entry.recordId, current as any, { ...current, deletedAt: null } as any);
        return { success: true, message: "Remoção revertida — registro restaurado." };
      }

      if (entry.operation === "UPDATE") {
        // Reverse of UPDATE = restore previous state
        if (!prevState) return { success: false, message: "Estado anterior não disponível." };

        const [current] = await db.select().from(table).where(eq(table.id, entry.recordId));
        if (!current) return { success: false, message: "Registro não encontrado." };

        // Build update set from prevState, excluding system fields
        const updateSet: Record<string, any> = {};
        const SYSTEM_FIELDS = new Set(["id", "createdAt", "created_at"]);
        for (const [key, val] of Object.entries(prevState)) {
          if (SYSTEM_FIELDS.has(key)) continue;
          if (key === "updatedAt" || key === "updated_at") {
            updateSet[key] = new Date();
            continue;
          }
          updateSet[key] = val;
        }
        await db.update(table).set(updateSet).where(eq(table.id, entry.recordId));
        const [restored] = await db.select().from(table).where(eq(table.id, entry.recordId));
        await logCompensate(entry.tableName, entry.recordId, current as any, restored as any);
        return { success: true, message: "Atualização revertida — estado anterior restaurado." };
      }

      if (entry.operation === "RESTORE") {
        // Reverse of RESTORE = re-soft-delete
        const [current] = await db.select().from(table).where(eq(table.id, entry.recordId));
        if (!current) return { success: false, message: "Registro não encontrado." };

        await db.update(table).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(table.id, entry.recordId));
        await logCompensate(entry.tableName, entry.recordId, current as any, { ...current, deletedAt: new Date().toISOString() } as any);
        return { success: true, message: "Restauração revertida — registro removido novamente." };
      }

      return { success: false, message: "Tipo de operação não suportado para reversão." };
    } catch (err: any) {
      return { success: false, message: `Erro na reversão: ${err?.message || "Erro desconhecido"}` };
    }
  },
  zod$({ entryId: z.string().uuid() })
);

// ── Component ────────────────────────────────────────────
export default component$(() => {
  const ledgerData = useLedger();
  const reverseAction = useReverseLedgerEntry();
  const { data, totalCount, page, pageSize } = ledgerData.value;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const toasts = useStore<{ items: ToastData[] }>({ items: [] });
  const reversingId = useSignal<string | null>(null);
  const reversingLabel = useSignal("");

  const addToast = $((type: ToastData["type"], title: string, message?: string) => {
    toasts.items = [...toasts.items, createToast(type, title, message)];
  });
  const dismissToast = $((id: string) => {
    toasts.items = toasts.items.filter((t) => t.id !== id);
  });

  return (
    <div class="space-y-6">
      <ToastContainer toasts={toasts.items} onDismiss$={dismissToast} />

      {/* Header */}
      <div>
        <h1 class="m-0 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Auditoria</h1>
        <p class="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Registro imutável de todas as operações do sistema (append-only ledger)
        </p>
      </div>

      {/* Filters */}
      <form class="flex flex-wrap items-end gap-3">
        <div>
          <label class="label text-xs">Tabela</label>
          <select name="tableName" class="input select" style={{ width: "auto" }}>
            <option value="">Todas as tabelas</option>
            {Object.entries(TABLE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label class="label text-xs">Operação</label>
          <select name="operation" class="input select" style={{ width: "auto" }}>
            <option value="">Todas operações</option>
            {Object.entries(OP_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label class="label text-xs">De</label>
          <input name="startDate" type="date" class="input" style={{ width: "auto" }} />
        </div>
        <div>
          <label class="label text-xs">Até</label>
          <input name="endDate" type="date" class="input" style={{ width: "auto" }} />
        </div>
        <button type="submit" class="btn btn-secondary">Filtrar</button>
      </form>

      {/* Card Timeline */}
      {data.length === 0 ? (
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <LuShieldCheck style={{ width: "48px", height: "48px", color: "var(--text-tertiary)", marginBottom: "12px" }} />
          <p class="text-base font-medium" style={{ color: "var(--text-secondary)" }}>Nenhum registro de auditoria</p>
          <p class="text-sm" style={{ color: "var(--text-tertiary)" }}>Operações aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <div class="space-y-3">
          {data.map((entry: any) => {
            const opColor = OP_COLORS[entry.operation] || OP_COLORS.COMPENSATE;
            const diff = computeDiff(entry.operation, entry.oldState, entry.newState);
            return (
              <div key={entry.id} class="card p-4" style={{ borderLeft: `3px solid ${opColor.text}` }}>
                {/* Header Row */}
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span
                      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: opColor.bg, color: opColor.text }}
                    >
                      {OP_LABELS[entry.operation] || entry.operation}
                    </span>
                    <span class="badge badge-neutral">
                      {TABLE_LABELS[entry.tableName] || entry.tableName}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
                      {new Date(entry.timestamp).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>

                {/* Metadata Row */}
                <div class="space-y-1 text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                  <div>
                    <span class="font-medium">Tabela: </span>
                    <span>{entry.tableName}</span>
                  </div>
                  <div>
                    <span class="font-medium">ID do Registro: </span>
                    <code
                      class="text-xs select-all"
                      style={{
                        color: "var(--text-primary)",
                        background: "var(--bg-hover)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontFamily: "monospace",
                      }}
                    >
                      {entry.recordId}
                    </code>
                  </div>
                  <div>
                    <span class="font-medium">Realizado por: </span>
                    <span>{entry.performedBy}</span>
                  </div>
                </div>

                {/* Human-Readable Diff */}
                {diff.length > 0 && (
                  <details
                    open={diff.some((d) => d.type === "changed")}
                    class="group"
                    style={{
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-default)",
                      overflow: "hidden",
                      background: "var(--bg-input)",
                    }}
                  >
                    <summary
                      class="cursor-pointer flex items-center justify-between px-3 py-2.5 text-xs font-semibold select-none"
                      style={{
                        color: "var(--text-primary)",
                        background: "var(--bg-input)",
                        listStyle: "none",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center justify-center rounded-md"
                          style={{
                            width: "22px",
                            height: "22px",
                            background: opColor.bg,
                            color: opColor.text,
                          }}
                        >
                          <LuChevronDown
                            style={{
                              width: "14px",
                              height: "14px",
                              transition: "transform 0.2s ease",
                            }}
                            class="group-open:rotate-180"
                          />
                        </span>
                        <span>
                          {entry.operation === "CREATE" ? "Dados criados" :
                           entry.operation === "DELETE" ? "Dados removidos" :
                           entry.operation === "UPDATE" ? `${diff.length} campo(s) alterado(s)` :
                           "Detalhes"}
                        </span>
                      </div>
                      <span
                        class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: "var(--bg-hover)", color: "var(--text-tertiary)" }}
                      >
                        {diff.length} campo{diff.length !== 1 ? "s" : ""}
                      </span>
                    </summary>
                    <div
                      class="overflow-hidden text-xs"
                      style={{ borderTop: "1px solid var(--border-default)" }}
                    >
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "var(--bg-hover)" }}>
                            <th class="text-left px-3 py-2 font-medium" style={{ color: "var(--text-secondary)", width: "30%" }}>Campo</th>
                            {(entry.operation === "UPDATE" || entry.operation === "RESTORE") && (
                              <th class="text-left px-3 py-2 font-medium" style={{ color: "var(--text-secondary)", width: "35%" }}>Antes</th>
                            )}
                            <th class="text-left px-3 py-2 font-medium" style={{ color: "var(--text-secondary)" }}>
                              {entry.operation === "UPDATE" || entry.operation === "RESTORE" ? "Depois" : "Valor"}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {diff.map((d) => (
                            <tr
                              key={d.field}
                              style={{
                                borderTop: "1px solid var(--border-default)",
                                background: d.type === "changed" ? "rgba(59,130,246,0.05)" :
                                            d.type === "added" ? "rgba(16,185,129,0.05)" :
                                            d.type === "removed" ? "rgba(239,68,68,0.05)" : "transparent",
                              }}
                            >
                              <td class="px-3 py-2 font-medium" style={{ color: "var(--text-primary)" }}>
                                {d.label}
                              </td>
                              {(entry.operation === "UPDATE" || entry.operation === "RESTORE") && (
                                <td class="px-3 py-2" style={{ color: "var(--text-tertiary)", textDecoration: d.type === "changed" ? "line-through" : "none" }}>
                                  {d.oldVal || "—"}
                                </td>
                              )}
                              <td class="px-3 py-2" style={{ color: d.type === "changed" ? "#3b82f6" : d.type === "added" ? "#10b981" : "var(--text-secondary)" }}>
                                {d.newVal}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}

                {/* Reversal Button */}
                <div class="flex items-center justify-end mt-3 pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
                  {entry.canReverse ? (
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      style={{ color: "var(--color-danger)", gap: "6px" }}
                      onClick$={() => {
                        const opLabel = OP_LABELS[entry.operation] || entry.operation;
                        const tableLabel = TABLE_LABELS[entry.tableName] || entry.tableName;
                        reversingLabel.value = `${opLabel} em ${tableLabel}`;
                        reversingId.value = entry.id;
                      }}
                    >
                      <LuUndo2 style={{ width: "14px", height: "14px" }} />
                      Reverter
                    </button>
                  ) : (
                    <span
                      class="text-xs"
                      style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}
                      title={entry.reverseReason}
                    >
                      {entry.reverseReason}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div class="flex items-center justify-between">
          <span class="text-sm" style={{ color: "var(--text-secondary)" }}>
            {totalCount} registro{totalCount !== 1 ? "s" : ""} de auditoria
          </span>
          <div class="flex items-center gap-1">
            <a href={`?page=${Math.max(1, page - 1)}`} class={`btn btn-ghost btn-sm btn-icon ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}><LuChevronLeft style={{ width: "16px", height: "16px" }} /></a>
            <span class="px-3 text-sm" style={{ color: "var(--text-secondary)" }}>{page} / {totalPages}</span>
            <a href={`?page=${Math.min(totalPages, page + 1)}`} class={`btn btn-ghost btn-sm btn-icon ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}><LuChevronRight style={{ width: "16px", height: "16px" }} /></a>
          </div>
        </div>
      )}

      {/* Reversal Confirmation */}
      <ConfirmDialog
        isOpen={!!reversingId.value}
        title="Reverter Operação"
        message={`Tem certeza que deseja reverter esta operação (${reversingLabel.value})? Uma entrada de compensação será criada no ledger.`}
        confirmLabel="Reverter"
        onConfirm$={async () => {
          if (!reversingId.value) return;
          const entryId = reversingId.value;
          reversingId.value = null;
          try {
            const result = await reverseAction.submit({ entryId });
            if (result.value?.success) {
              addToast("success", result.value.message);
            } else {
              addToast("error", result.value?.message || "Erro ao reverter.");
            }
          } catch (err: any) {
            addToast("error", "Erro inesperado", err?.message || "");
          }
        }}
        onCancel$={() => (reversingId.value = null)}
      />
    </div>
  );
});

export const head: DocumentHead = {
  title: "Auditoria — HealthPanel",
  meta: [{ name: "description", content: "Registro imutável de todas as operações (append-only ledger)." }],
};
