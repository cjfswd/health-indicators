import { component$, useSignal, useStore, $ } from "@builder.io/qwik";
import {
  type DocumentHead,
  routeLoader$,
  routeAction$,
  zod$,
  z,
} from "@builder.io/qwik-city";
import { eq, and, asc, sql } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { indicatorDefinitions } from "~/db/schema";
import { logUpdate } from "~/lib/ledger";
import { Modal } from "~/components/ui/modal";
import { ToastContainer, createToast, type ToastData } from "~/components/ui/toast";
import {
  LuPencil,
  LuTarget,
  LuTrendingUp,
  LuTrendingDown,
  LuInfo,
  LuArrowUpRight,
  LuArrowDownRight,
} from "@qwikest/icons/lucide";

// ── Labels ───────────────────────────────────────────────
const DIRECTION_LABELS: Record<string, string> = {
  higher_is_better: "Maior é melhor",
  lower_is_better: "Menor é melhor",
};

const TIMEFRAME_LABELS: Record<string, string> = {
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  quadrimestral: "Quadrimestral",
  semestral: "Semestral",
  annual: "Anual",
};

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  "01": { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  "02": { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  "03": { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  "04": { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  "05": { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  "06": { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  "07": { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  "08": { color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
  "09": { color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
};

// ── Data Loader ──────────────────────────────────────────
export const useIndicators = routeLoader$(async () => {
  const data = await db
    .select()
    .from(indicatorDefinitions)
    .where(and(
      eq(indicatorDefinitions.active, true),
      sql`${indicatorDefinitions.parentId} IS NULL`,
    ))
    .orderBy(asc(indicatorDefinitions.code));

  return data.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    targetValue: d.targetValue,
    targetDirection: d.targetDirection,
    targetTimeframe: d.targetTimeframe,
    targetFormat: d.targetFormat,
    isInformational: d.isInformational,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }));
});

// ── Update Action ────────────────────────────────────────
export const useUpdateIndicator = routeAction$(
  async (data) => {
    const [existing] = await db
      .select()
      .from(indicatorDefinitions)
      .where(eq(indicatorDefinitions.id, data.id));
    if (!existing) return { success: false, message: "Indicador não encontrado." };

    const isInfo = data.isInformational === "true";

    const updateData: any = {
      targetValue: isInfo ? null : (data.targetValue ? parseFloat(data.targetValue) : null),
      targetDirection: isInfo ? null : (data.targetDirection || null),
      targetTimeframe: isInfo ? null : (data.targetTimeframe || null),
      targetFormat: isInfo ? "percentage" : (data.targetFormat || "percentage"),
      isInformational: isInfo,
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(indicatorDefinitions)
      .set(updateData)
      .where(eq(indicatorDefinitions.id, data.id))
      .returning();

    await logUpdate("indicator_definitions", data.id, existing as any, updated as any);
    return { success: true, message: `Meta do indicador ${existing.code} atualizada!` };
  },
  zod$({
    id: z.string().uuid(),
    targetValue: z.string().optional(),
    targetDirection: z.string().optional(),
    targetTimeframe: z.string().optional(),
    targetFormat: z.string().optional(),
    isInformational: z.string().optional(),
  })
);

// ── Component ────────────────────────────────────────────
export default component$(() => {
  const indicators = useIndicators();
  const updateAction = useUpdateIndicator();

  const editingId = useSignal<string | null>(null);
  const toasts = useStore<{ items: ToastData[] }>({ items: [] });

  // Edit form signals
  const editTargetValue = useSignal("");
  const editDirection = useSignal("");
  const editTimeframe = useSignal("");
  const editFormat = useSignal("percentage");
  const editIsInformational = useSignal(false);

  const addToast = $((type: ToastData["type"], title: string, message?: string) => {
    toasts.items = [...toasts.items, createToast(type, title, message)];
  });
  const dismissToast = $((id: string) => {
    toasts.items = toasts.items.filter((t) => t.id !== id);
  });

  const data = indicators.value;

  return (
    <div class="space-y-6">
      <ToastContainer toasts={toasts.items} onDismiss$={dismissToast} />

      {/* Header */}
      <div>
        <h1 class="m-0 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Metas
        </h1>
        <p class="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Defina e gerencie as metas de cada indicador de desempenho
        </p>
      </div>

      {/* Legend Cards */}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="card p-4 flex items-center gap-3">
          <div
            class="flex items-center justify-center rounded-lg"
            style={{ width: "36px", height: "36px", background: "rgba(16,185,129,0.12)", color: "#10b981" }}
          >
            <LuArrowUpRight style={{ width: "18px", height: "18px" }} />
          </div>
          <div>
            <p class="m-0 text-sm font-medium" style={{ color: "var(--text-primary)" }}>Maior é melhor</p>
            <p class="m-0 text-xs" style={{ color: "var(--text-tertiary)" }}>Valor deve atingir ou superar a meta</p>
          </div>
        </div>
        <div class="card p-4 flex items-center gap-3">
          <div
            class="flex items-center justify-center rounded-lg"
            style={{ width: "36px", height: "36px", background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
          >
            <LuArrowDownRight style={{ width: "18px", height: "18px" }} />
          </div>
          <div>
            <p class="m-0 text-sm font-medium" style={{ color: "var(--text-primary)" }}>Menor é melhor</p>
            <p class="m-0 text-xs" style={{ color: "var(--text-tertiary)" }}>Valor deve ficar abaixo da meta</p>
          </div>
        </div>
        <div class="card p-4 flex items-center gap-3">
          <div
            class="flex items-center justify-center rounded-lg"
            style={{ width: "36px", height: "36px", background: "rgba(107,114,128,0.12)", color: "#6b7280" }}
          >
            <LuInfo style={{ width: "18px", height: "18px" }} />
          </div>
          <div>
            <p class="m-0 text-sm font-medium" style={{ color: "var(--text-primary)" }}>Informacional</p>
            <p class="m-0 text-xs" style={{ color: "var(--text-tertiary)" }}>Sem meta — apenas acompanhamento</p>
          </div>
        </div>
      </div>

      {/* Indicators Table */}
      <div class="table-container">
        {data.length === 0 ? (
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <LuTarget style={{ width: "48px", height: "48px", color: "var(--text-tertiary)", marginBottom: "12px" }} />
            <p class="text-base font-medium" style={{ color: "var(--text-secondary)" }}>
              Nenhum indicador cadastrado
            </p>
          </div>
        ) : (
          <table class="data-table">
            <thead>
              <tr>
                <th style={{ width: "80px" }}>Código</th>
                <th>Indicador</th>
                <th style={{ width: "120px" }}>Meta</th>
                <th style={{ width: "150px" }}>Direção</th>
                <th style={{ width: "140px" }}>Periodicidade</th>
                <th style={{ width: "110px" }}>Tipo</th>
                <th style={{ width: "80px" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((ind) => {
                const colors = CATEGORY_COLORS[ind.code] || { color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
                return (
                  <tr key={ind.id}>
                    <td>
                      <span
                        class="text-xs font-bold"
                        style={{
                          color: colors.color,
                          background: colors.bg,
                          padding: "3px 10px",
                          borderRadius: "var(--radius-full)",
                        }}
                      >
                        {ind.code}
                      </span>
                    </td>
                    <td>
                      <span class="font-medium" style={{ color: "var(--text-primary)" }}>{ind.name}</span>
                    </td>
                    <td>
                      {ind.isInformational ? (
                        <span class="text-xs" style={{ color: "var(--text-tertiary)" }}>—</span>
                      ) : (
                        <span class="font-semibold" style={{ color: "var(--text-primary)" }}>
                          {ind.targetDirection === "lower_is_better" ? "≤" : "≥"} {ind.targetValue ?? "—"}{ind.targetFormat === "percentage" ? "%" : ""}
                        </span>
                      )}
                    </td>
                    <td>
                      {ind.isInformational ? (
                        <span class="text-xs" style={{ color: "var(--text-tertiary)" }}>—</span>
                      ) : (
                        <span class="flex items-center gap-1 text-sm" style={{
                          color: ind.targetDirection === "higher_is_better" ? "#10b981" : "#ef4444"
                        }}>
                          {ind.targetDirection === "higher_is_better"
                            ? <LuTrendingUp style={{ width: "14px", height: "14px" }} />
                            : <LuTrendingDown style={{ width: "14px", height: "14px" }} />}
                          {DIRECTION_LABELS[ind.targetDirection || ""] || "—"}
                        </span>
                      )}
                    </td>
                    <td>
                      <span class="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {ind.isInformational ? "—" : (TIMEFRAME_LABELS[ind.targetTimeframe || ""] || "—")}
                      </span>
                    </td>
                    <td>
                      <span class={ind.isInformational ? "badge badge-neutral" : "badge badge-success"}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "currentColor" }} />
                        {ind.isInformational ? "Info" : "Meta"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        class="btn btn-ghost btn-icon btn-sm"
                        title="Editar meta"
                        onClick$={() => {
                          editingId.value = ind.id;
                          editTargetValue.value = ind.targetValue != null ? String(ind.targetValue) : "";
                          editDirection.value = ind.targetDirection || "higher_is_better";
                          editTimeframe.value = ind.targetTimeframe || "monthly";
                          editFormat.value = ind.targetFormat || "percentage";
                          editIsInformational.value = ind.isInformational;
                        }}
                      >
                        <LuPencil style={{ width: "15px", height: "15px" }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingId.value}
        onClose$={() => (editingId.value = null)}
        title="Editar Meta do Indicador"
        size="sm"
      >
        <form
          preventdefault:submit
          onSubmit$={async () => {
            if (!editingId.value) return;
            const result = await updateAction.submit({
              id: editingId.value,
              targetValue: editIsInformational.value ? "" : editTargetValue.value,
              targetDirection: editIsInformational.value ? "" : editDirection.value,
              targetTimeframe: editIsInformational.value ? "" : editTimeframe.value,
              targetFormat: editIsInformational.value ? "percentage" : editFormat.value,
              isInformational: editIsInformational.value ? "true" : "false",
            });
            if (result.value.success) {
              editingId.value = null;
              addToast("success", result.value.message);
              window.location.reload();
            } else {
              addToast("error", result.value.message);
            }
          }}
        >
          <div class="space-y-4">
            {/* Informational Toggle */}
            <div class="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-hover)" }}>
              <div>
                <p class="m-0 text-sm font-medium" style={{ color: "var(--text-primary)" }}>Apenas informacional</p>
                <p class="m-0 text-xs" style={{ color: "var(--text-tertiary)" }}>Sem meta — somente acompanhamento</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  checked={editIsInformational.value}
                  onChange$={(e) => {
                    editIsInformational.value = (e.target as HTMLInputElement).checked;
                  }}
                />
                <div
                  class="w-11 h-6 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                  style={{
                    background: editIsInformational.value ? "var(--color-primary-500)" : "var(--bg-active)",
                  }}
                />
              </label>
            </div>

            {/* Target Fields (hidden when informational) */}
            {!editIsInformational.value && (
              <>
                <div>
                  <label class="label" for="target-format">
                    Formato da Meta <span style={{ color: "var(--color-danger)" }}>*</span>
                  </label>
                  <select
                    id="target-format"
                    class="input select"
                    bind:value={editFormat}
                    required
                  >
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="numeric">Valor Numérico</option>
                  </select>
                </div>
                <div>
                  <label class="label" for="target-value">
                    Valor da Meta {editFormat.value === "percentage" ? "(%)" : ""} <span style={{ color: "var(--color-danger)" }}>*</span>
                  </label>
                  <input
                    id="target-value"
                    type="number"
                    step="0.1"
                    class="input"
                    placeholder={editFormat.value === "percentage" ? "Ex: 10" : "Ex: 150"}
                    bind:value={editTargetValue}
                    required
                  />
                </div>
                <div>
                  <label class="label" for="target-direction">
                    Direção <span style={{ color: "var(--color-danger)" }}>*</span>
                  </label>
                  <select
                    id="target-direction"
                    class="input select"
                    bind:value={editDirection}
                    required
                  >
                    <option value="higher_is_better">Maior é melhor (≥)</option>
                    <option value="lower_is_better">Menor é melhor (≤)</option>
                  </select>
                </div>
                <div>
                  <label class="label" for="target-timeframe">
                    Periodicidade <span style={{ color: "var(--color-danger)" }}>*</span>
                  </label>
                  <select
                    id="target-timeframe"
                    class="input select"
                    bind:value={editTimeframe}
                    required
                  >
                    <option value="monthly">Mensal</option>
                    <option value="bimonthly">Bimestral</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="quadrimestral">Quadrimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
              </>
            )}

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="btn btn-secondary" onClick$={() => (editingId.value = null)}>
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary" disabled={updateAction.isRunning}>
                {updateAction.isRunning ? "Salvando..." : "Salvar Meta"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Metas — Health Indicators",
  meta: [{ name: "description", content: "Defina e gerencie as metas de cada indicador de desempenho." }],
};
