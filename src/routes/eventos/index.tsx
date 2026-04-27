import { component$, useSignal, useStore, $ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$, routeAction$, zod$, z } from "@builder.io/qwik-city";
import { eq, and, isNull, sql, desc, gte, lte, like } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { events, patients, healthOperators } from "~/db/schema";
import { logCreate, logUpdate, logDelete } from "~/lib/ledger";
import { Modal } from "~/components/ui/modal";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { ToastContainer, createToast, type ToastData } from "~/components/ui/toast";
import { CategoryBadge, SubCategoryBadge } from "~/components/ui/badge";
import { Combobox, type ComboboxOption } from "~/components/ui/combobox";
import { FileUpload, type UploadedFile } from "~/components/ui/file-upload";
import { LuPlus, LuPencil, LuTrash2, LuCalendarClock, LuChevronLeft, LuChevronRight } from "@qwikest/icons/lucide";

// ── Category / Subcategory unified options ───────────────
const CATEGORY_OPTIONS = [
  { value: "alta_domiciliar", label: "Alta Domiciliar" },
  { value: "intercorrencia", label: "Intercorrência" },
  { value: "internacao_hospitalar", label: "Internação Hospitalar" },
  { value: "obito", label: "Óbito" },
  { value: "alteracao_pad", label: "Alteração PAD" },
  { value: "quantitativo_paciente", label: "Quantitativo" },
  { value: "paciente_infectado", label: "Paciente Infectado" },
  { value: "evento_adverso", label: "Evento Adverso" },
  { value: "ouvidoria", label: "Ouvidoria" },
];

const SUB_CATEGORY_MAP: Record<string, { value: string; label: string }[]> = {
  intercorrencia: [
    { value: "resolvida_domicilio", label: "Resolvida em domicílio" },
    { value: "remocao_aph", label: "Remoção APH" },
  ],
  internacao_hospitalar: [
    { value: "deterioracao_clinica", label: "Deterioração clínica" },
    { value: "nao_aderencia_tratamento", label: "Não aderência ao tratamento" },
  ],
  obito: [
    { value: "obito_menos_48h", label: "Menos de 48h" },
    { value: "obito_mais_48h", label: "Mais de 48h" },
  ],
  evento_adverso: [
    { value: "queda", label: "Queda" },
    { value: "broncoaspiracao", label: "Broncoaspiração" },
    { value: "lesao_pressao", label: "Lesão por pressão" },
    { value: "decanulacao", label: "Decanulação" },
    { value: "saida_acidental_gtt", label: "Saída acidental GTT" },
  ],
  ouvidoria: [
    { value: "elogio", label: "Elogio" },
    { value: "sugestao", label: "Sugestão" },
    { value: "reclamacao_solicitacao", label: "Reclamação/Solicitação" },
  ],
};

// Build unified select options: if parent has subs, show only subs
function buildUnifiedOptions() {
  const options: { value: string; category: string; subCategory: string; label: string }[] = [];
  for (const cat of CATEGORY_OPTIONS) {
    const subs = SUB_CATEGORY_MAP[cat.value];
    if (subs && subs.length > 0) {
      for (const sub of subs) {
        options.push({ value: `${cat.value}::${sub.value}`, category: cat.value, subCategory: sub.value, label: `${cat.label} › ${sub.label}` });
      }
    } else {
      options.push({ value: `${cat.value}::`, category: cat.value, subCategory: "", label: cat.label });
    }
  }
  return options;
}
const UNIFIED_OPTIONS = buildUnifiedOptions();

function parseUnifiedValue(val: string) {
  const [category, subCategory] = val.split("::");
  return { category, subCategory: subCategory || null };
}

// ── Data Loaders ─────────────────────────────────────────
export const useEvents = routeLoader$(async ({ query }) => {
  const page = parseInt(query.get("page") || "1");
  const pageSize = parseInt(query.get("pageSize") || "15");
  const category = query.get("category");
  const startDate = query.get("startDate");
  const endDate = query.get("endDate");
  const patientName = query.get("patientName");
  const operatorId = query.get("operatorId");

  const conditions = [isNull(events.deletedAt)];
  if (category) conditions.push(eq(events.category, category as any));
  if (startDate) conditions.push(gte(events.occurredAt, new Date(startDate)));
  if (endDate) conditions.push(lte(events.occurredAt, new Date(endDate)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  let [data, countResult] = await Promise.all([
    db.query.events.findMany({
      where,
      with: { patient: true, operator: true },
      orderBy: desc(events.occurredAt),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db.select({ count: sql<number>`count(*)` }).from(events).where(where),
  ]);

  // Server-side patient name filter (post-join)
  if (patientName) {
    data = data.filter((d) => d.patient?.fullName?.toLowerCase().includes(patientName.toLowerCase()));
  }
  if (operatorId) {
    data = data.filter((d) => d.operatorId === operatorId);
  }

  return {
    data: data.map((d) => ({
      ...d,
      occurredAt: d.occurredAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      deletedAt: d.deletedAt?.toISOString() || null,
      attachments: d.attachments || [],
    })),
    totalCount: Number(countResult[0].count),
    page,
    pageSize,
  };
});

export const usePatientOptions = routeLoader$(async () => {
  const pts = await db.query.patients.findMany({
    where: isNull(patients.deletedAt),
    with: { operator: true },
    orderBy: patients.fullName,
  });
  return pts.map((p) => ({ id: p.id, fullName: p.fullName, operatorId: p.operatorId, operatorName: (p as any).operator?.name || "" }));
});

export const useOperatorOptions = routeLoader$(async () => {
  return await db.select({ id: healthOperators.id, name: healthOperators.name }).from(healthOperators).where(isNull(healthOperators.deletedAt)).orderBy(healthOperators.name);
});

// ── Actions ──────────────────────────────────────────────
export const useCreateEvent = routeAction$(
  async (data) => {
    const { category, subCategory } = parseUnifiedValue(data.unifiedCategory);
    // Get operator from patient
    const [patient] = await db.select().from(patients).where(eq(patients.id, data.patientId));
    if (!patient) return { success: false, message: "Paciente não encontrado." };

    const [created] = await db.insert(events).values({
      patientId: data.patientId,
      operatorId: patient.operatorId,
      category: category as any,
      subCategory: (subCategory || null) as any,
      occurredAt: new Date(data.occurredAt),
      description: data.description || null,
      attachments: data.attachments ? JSON.parse(data.attachments) : [],
    }).returning();
    await logCreate("events", created as any);
    return { success: true, message: "Evento registrado com sucesso!" };
  },
  zod$({
    patientId: z.string().uuid(),
    unifiedCategory: z.string().min(1),
    occurredAt: z.string().min(1),
    description: z.string().optional(),
    attachments: z.string().optional(),
  })
);

export const useUpdateEvent = routeAction$(
  async (data) => {
    const [existing] = await db.select().from(events).where(eq(events.id, data.id));
    if (!existing) return { success: false, message: "Evento não encontrado." };

    const updateData: any = { updatedAt: new Date() };
    if (data.unifiedCategory) {
      const { category, subCategory } = parseUnifiedValue(data.unifiedCategory);
      updateData.category = category;
      updateData.subCategory = subCategory || null;
    }
    if (data.patientId) {
      updateData.patientId = data.patientId;
      const [patient] = await db.select().from(patients).where(eq(patients.id, data.patientId));
      if (patient) updateData.operatorId = patient.operatorId;
    }
    if (data.occurredAt) updateData.occurredAt = new Date(data.occurredAt);
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.attachments) updateData.attachments = JSON.parse(data.attachments);

    const [updated] = await db.update(events).set(updateData).where(eq(events.id, data.id)).returning();
    await logUpdate("events", data.id, existing as any, updated as any);
    return { success: true, message: "Evento atualizado!" };
  },
  zod$({
    id: z.string().uuid(),
    patientId: z.string().uuid().optional(),
    unifiedCategory: z.string().optional(),
    occurredAt: z.string().optional(),
    description: z.string().optional(),
    attachments: z.string().optional(),
  })
);

export const useDeleteEvent = routeAction$(
  async (data) => {
    const [existing] = await db.select().from(events).where(eq(events.id, data.id));
    if (!existing) return { success: false, message: "Evento não encontrado." };
    await db.update(events).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(events.id, data.id));
    await logDelete("events", data.id, existing as any);
    return { success: true, message: "Evento removido." };
  },
  zod$({ id: z.string().uuid() })
);

// ── Component ────────────────────────────────────────────
export default component$(() => {
  const eventsData = useEvents();
  const patientOptions = usePatientOptions();
  const operatorOptions = useOperatorOptions();
  const createAction = useCreateEvent();
  const updateAction = useUpdateEvent();
  const deleteAction = useDeleteEvent();

  const showCreateModal = useSignal(false);
  const editingEvent = useSignal<any>(null);
  const deletingId = useSignal<string | null>(null);
  const toasts = useStore<{ items: ToastData[] }>({ items: [] });

  const selectedPatientId = useSignal("");
  const editPatientId = useSignal("");
  const autoOperatorName = useSignal("");
  const editAutoOperatorName = useSignal("");
  const uploadedFiles = useSignal<UploadedFile[]>([]);

  const addToast = $((type: ToastData["type"], title: string) => {
    toasts.items = [...toasts.items, createToast(type, title)];
  });
  const dismissToast = $((id: string) => {
    toasts.items = toasts.items.filter((t) => t.id !== id);
  });

  const { data, totalCount, page, pageSize } = eventsData.value;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const patientComboOptions: ComboboxOption[] = patientOptions.value.map((p) => ({ value: p.id, label: p.fullName }));
  const operatorComboOptions: ComboboxOption[] = operatorOptions.value.map((o) => ({ value: o.id, label: o.name }));

  return (
    <div class="space-y-6">
      <ToastContainer toasts={toasts.items} onDismiss$={dismissToast} />

      {/* Header */}
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="m-0 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Eventos</h1>
          <p class="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Registre e acompanhe ocorrências médicas</p>
        </div>
        <button type="button" class="btn btn-primary" onClick$={() => {
          selectedPatientId.value = "";
          autoOperatorName.value = "";
          uploadedFiles.value = [];
          showCreateModal.value = true;
        }}>
          <LuPlus style={{ width: "18px", height: "18px" }} />
          Novo Evento
        </button>
      </div>

      {/* Filters */}
      <form class="flex flex-wrap items-end gap-3">
        <div class="w-full max-w-xs">
          <label class="label text-xs">Paciente</label>
          <input name="patientName" type="text" class="input" placeholder="Nome do paciente..." />
        </div>
        <div>
          <label class="label text-xs">Categoria</label>
          <select name="category" class="input select" style={{ width: "auto" }}>
            <option value="">Todas</option>
            {CATEGORY_OPTIONS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
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
        <button type="submit" class="btn btn-secondary btn-sm">Filtrar</button>
      </form>

      {/* Card Grid */}
      {data.length === 0 ? (
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <LuCalendarClock style={{ width: "48px", height: "48px", color: "var(--text-tertiary)", marginBottom: "12px" }} />
          <p class="text-base font-medium" style={{ color: "var(--text-secondary)" }}>Nenhum evento registrado</p>
          <p class="text-sm" style={{ color: "var(--text-tertiary)" }}>Clique em "Novo Evento" para começar.</p>
        </div>
      ) : (
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((ev: any) => (
            <div key={ev.id} class="card p-4">
              {/* Card Header */}
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2 flex-wrap">
                  <CategoryBadge category={ev.category} />
                  {ev.subCategory && <SubCategoryBadge subCategory={ev.subCategory} />}
                </div>
                <span class="text-xs whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
                  {new Date(ev.occurredAt).toLocaleDateString("pt-BR")}
                </span>
              </div>

              {/* Card Body */}
              <div class="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <div class="flex items-center justify-between">
                  <span>Paciente</span>
                  <span class="font-medium truncate ml-2" style={{ color: "var(--text-primary)" }}>{ev.patient?.fullName || "—"}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>Operadora</span>
                  <span class="truncate ml-2">{ev.operator?.name || "—"}</span>
                </div>
                {ev.description && (
                  <div class="mt-2 rounded-md p-2 text-xs" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                    {ev.description.length > 120 ? ev.description.substring(0, 120) + "..." : ev.description}
                  </div>
                )}
                {ev.attachments && ev.attachments.length > 0 && (
                  <div class="flex items-center justify-between">
                    <span>Anexos</span>
                    <span class="badge badge-neutral">{ev.attachments.length}</span>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              {!ev.deletedAt && (
                <div class="flex items-center justify-end gap-1 mt-3 pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
                  <button type="button" class="btn btn-ghost btn-icon btn-sm" title="Editar"
                    onClick$={() => {
                      editingEvent.value = ev;
                      editPatientId.value = ev.patientId;
                      editAutoOperatorName.value = ev.operator?.name || "";
                      uploadedFiles.value = ev.attachments || [];
                    }}
                  >
                    <LuPencil style={{ width: "15px", height: "15px" }} />
                  </button>
                  <button type="button" class="btn btn-ghost btn-icon btn-sm" title="Remover" style={{ color: "var(--color-danger)" }}
                    onClick$={() => (deletingId.value = ev.id)}
                  >
                    <LuTrash2 style={{ width: "15px", height: "15px" }} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div class="flex items-center justify-between">
          <span class="text-sm" style={{ color: "var(--text-secondary)" }}>{totalCount} evento{totalCount !== 1 ? "s" : ""}</span>
          <div class="flex items-center gap-1">
            <a href={`?page=${Math.max(1, page - 1)}`} class={`btn btn-ghost btn-sm btn-icon ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}><LuChevronLeft style={{ width: "16px", height: "16px" }} /></a>
            <span class="px-3 text-sm" style={{ color: "var(--text-secondary)" }}>{page} / {totalPages}</span>
            <a href={`?page=${Math.min(totalPages, page + 1)}`} class={`btn btn-ghost btn-sm btn-icon ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}><LuChevronRight style={{ width: "16px", height: "16px" }} /></a>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal.value} onClose$={() => (showCreateModal.value = false)} title="Novo Evento" size="lg">
        <form preventdefault:submit onSubmit$={async (e) => {
          const fd = new FormData(e.target as HTMLFormElement);
          const payload = {
            patientId: selectedPatientId.value,
            unifiedCategory: fd.get("unifiedCategory") as string,
            occurredAt: fd.get("occurredAt") as string,
            description: (fd.get("description") as string) || undefined,
            attachments: uploadedFiles.value.length > 0 ? JSON.stringify(uploadedFiles.value) : undefined,
          };
          const result = await createAction.submit(payload);
          if (result.value.success) { showCreateModal.value = false; addToast("success", result.value.message); }
          else addToast("error", result.value.message);
        }}>
          <div class="space-y-4">
            <div>
              <Combobox
                options={patientComboOptions}
                value={selectedPatientId.value}
                onChange$={(val) => {
                  selectedPatientId.value = val;
                  const pt = patientOptions.value.find((p) => p.id === val);
                  autoOperatorName.value = pt?.operatorName || "";
                }}
                placeholder="Buscar paciente..."
                label="Paciente"
                id="ev-patient"
                name="patientId"
                required
              />
            </div>
            {autoOperatorName.value && (
              <div class="rounded-md px-3 py-2 text-sm" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                Operadora: <strong style={{ color: "var(--text-primary)" }}>{autoOperatorName.value}</strong> (preenchida automaticamente)
              </div>
            )}
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label" for="ev-unified-cat">Categoria / Subcategoria <span style={{ color: "var(--color-danger)" }}>*</span></label>
                <select id="ev-unified-cat" name="unifiedCategory" class="input select" required>
                  <option value="">Selecione...</option>
                  {UNIFIED_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
              <div>
                <label class="label" for="ev-date">Data do Evento <span style={{ color: "var(--color-danger)" }}>*</span></label>
                <input id="ev-date" name="occurredAt" type="date" class="input" value={new Date().toISOString().split("T")[0]} required />
              </div>
            </div>
            <div>
              <label class="label" for="ev-desc">Descrição</label>
              <textarea id="ev-desc" name="description" class="input" rows={3} placeholder="Descreva o evento..." />
            </div>
            <FileUpload label="Anexos" value={uploadedFiles.value} onChange$={(files) => { uploadedFiles.value = files; }} maxSizeMB={5} multiple />
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="btn btn-secondary" onClick$={() => (showCreateModal.value = false)}>Cancelar</button>
              <button type="submit" class="btn btn-primary" disabled={createAction.isRunning}>
                {createAction.isRunning ? "Registrando..." : "Registrar Evento"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingEvent.value} onClose$={() => (editingEvent.value = null)} title="Editar Evento" size="lg">
        <form preventdefault:submit onSubmit$={async (e) => {
          if (!editingEvent.value) return;
          const fd = new FormData(e.target as HTMLFormElement);
          const payload = {
            id: editingEvent.value.id,
            patientId: editPatientId.value || undefined,
            unifiedCategory: (fd.get("unifiedCategory") as string) || undefined,
            occurredAt: (fd.get("occurredAt") as string) || undefined,
            description: (fd.get("description") as string) || undefined,
            attachments: uploadedFiles.value.length > 0 ? JSON.stringify(uploadedFiles.value) : undefined,
          };
          const result = await updateAction.submit(payload);
          if (result.value.success) { editingEvent.value = null; addToast("success", result.value.message); }
          else addToast("error", result.value.message);
        }}>
          <div class="space-y-4">
            <div>
              <Combobox
                options={patientComboOptions}
                value={editPatientId.value}
                onChange$={(val) => {
                  editPatientId.value = val;
                  const pt = patientOptions.value.find((p) => p.id === val);
                  editAutoOperatorName.value = pt?.operatorName || "";
                }}
                placeholder="Buscar paciente..."
                label="Paciente"
                id="eev-patient"
                name="patientId"
              />
            </div>
            {editAutoOperatorName.value && (
              <div class="rounded-md px-3 py-2 text-sm" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                Operadora: <strong style={{ color: "var(--text-primary)" }}>{editAutoOperatorName.value}</strong>
              </div>
            )}
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label" for="eev-unified-cat">Categoria / Subcategoria</label>
                <select id="eev-unified-cat" name="unifiedCategory" class="input select"
                  value={editingEvent.value ? `${editingEvent.value.category}::${editingEvent.value.subCategory || ""}` : ""}
                >
                  <option value="">Selecione...</option>
                  {UNIFIED_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
              <div>
                <label class="label" for="eev-date">Data do Evento</label>
                <input id="eev-date" name="occurredAt" type="date" class="input" value={editingEvent.value?.occurredAt?.split("T")[0] || ""} />
              </div>
            </div>
            <div>
              <label class="label" for="eev-desc">Descrição</label>
              <textarea id="eev-desc" name="description" class="input" rows={3} value={editingEvent.value?.description || ""} />
            </div>
            <FileUpload label="Anexos" value={uploadedFiles.value} onChange$={(files) => { uploadedFiles.value = files; }} maxSizeMB={5} multiple />
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="btn btn-secondary" onClick$={() => (editingEvent.value = null)}>Cancelar</button>
              <button type="submit" class="btn btn-primary" disabled={updateAction.isRunning}>{updateAction.isRunning ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog isOpen={!!deletingId.value} title="Remover Evento" message="Tem certeza que deseja remover este evento?"
        confirmLabel="Remover"
        onConfirm$={async () => {
          if (!deletingId.value) return;
          const result = await deleteAction.submit({ id: deletingId.value });
          deletingId.value = null;
          if (result.value.success) addToast("success", result.value.message);
          else addToast("error", result.value.message);
        }}
        onCancel$={() => (deletingId.value = null)}
      />
    </div>
  );
});

export const head: DocumentHead = {
  title: "Eventos — HealthPanel",
  meta: [{ name: "description", content: "Registre e acompanhe ocorrências médicas." }],
};
