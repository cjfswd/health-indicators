import { component$, useSignal, useStore, $ } from "@builder.io/qwik";
import {
  type DocumentHead,
  routeLoader$,
  routeAction$,
  zod$,
  z,
} from "@builder.io/qwik-city";
import { eq, and, isNull, like, sql, desc } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { patients, healthOperators } from "~/db/schema";
import { logCreate, logUpdate, logDelete, logRestore } from "~/lib/ledger";
import { Modal } from "~/components/ui/modal";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { ToastContainer, createToast, type ToastData } from "~/components/ui/toast";
import { StatusBadge, ModalityBadge } from "~/components/ui/badge";
import { Combobox, type ComboboxOption } from "~/components/ui/combobox";
import { FileUpload, type UploadedFile } from "~/components/ui/file-upload";
import {
  LuPlus,
  LuPencil,
  LuTrash2,
  LuRotateCcw,
  LuUsers,
  LuToggleLeft,
  LuToggleRight,
  LuChevronLeft,
  LuChevronRight,
  LuCalendar,
} from "@qwikest/icons/lucide";

// ── Data Loaders ─────────────────────────────────────────
export const usePatients = routeLoader$(async ({ query }) => {
  const page = parseInt(query.get("page") || "1");
  const pageSize = parseInt(query.get("pageSize") || "15");
  const search = query.get("search") || "";
  const includeDeleted = query.get("includeDeleted") === "true";
  const activeFilter = query.get("active");
  const modalityFilter = query.get("careModality");

  const conditions = [];
  if (!includeDeleted) conditions.push(isNull(patients.deletedAt));
  if (search) conditions.push(like(patients.fullName, `%${search}%`));
  if (activeFilter !== null && activeFilter !== undefined && activeFilter !== "")
    conditions.push(eq(patients.active, activeFilter === "true"));
  if (modalityFilter)
    conditions.push(eq(patients.careModality, modalityFilter as "AD" | "ID"));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.query.patients.findMany({
      where,
      with: { operator: true },
      orderBy: desc(patients.createdAt),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db.select({ count: sql<number>`count(*)` }).from(patients).where(where),
  ]);

  return {
    data: data.map((d) => ({
      ...d,
      dateOfBirth: d.dateOfBirth.toISOString(),
      admissionDate: d.admissionDate?.toISOString() || null,
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

export const useOperatorOptions = routeLoader$(async () => {
  const ops = await db
    .select({ id: healthOperators.id, name: healthOperators.name })
    .from(healthOperators)
    .where(isNull(healthOperators.deletedAt))
    .orderBy(healthOperators.name);
  return ops;
});

// ── Actions ──────────────────────────────────────────────
export const useCreatePatient = routeAction$(
  async (data) => {
    const [created] = await db.insert(patients).values({
      fullName: data.fullName,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender as any,
      careModality: data.careModality as any,
      operatorId: data.operatorId,
      admissionDate: data.admissionDate ? new Date(data.admissionDate) : null,
      attachments: data.attachments ? JSON.parse(data.attachments) : [],
    }).returning();
    await logCreate("patients", created as any);
    return { success: true, message: "Paciente cadastrado com sucesso!" };
  },
  zod$({
    fullName: z.string().min(1).max(255),
    dateOfBirth: z.string().min(1),
    gender: z.enum(["masculino", "feminino", "outro"]),
    careModality: z.enum(["AD", "ID"]),
    operatorId: z.string().uuid(),
    admissionDate: z.string().optional(),
    attachments: z.string().optional(),
  })
);

export const useUpdatePatient = routeAction$(
  async (data) => {
    const [existing] = await db.select().from(patients).where(eq(patients.id, data.id));
    if (!existing) return { success: false, message: "Paciente não encontrado." };

    const updateData: any = { updatedAt: new Date() };
    if (data.fullName) updateData.fullName = data.fullName;
    if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.gender) updateData.gender = data.gender;
    if (data.careModality) updateData.careModality = data.careModality;
    if (data.operatorId) updateData.operatorId = data.operatorId;
    if (data.admissionDate) updateData.admissionDate = new Date(data.admissionDate);
    if (data.attachments) updateData.attachments = JSON.parse(data.attachments);

    const [updated] = await db.update(patients).set(updateData).where(eq(patients.id, data.id)).returning();
    await logUpdate("patients", data.id, existing as any, updated as any);
    return { success: true, message: "Paciente atualizado!" };
  },
  zod$({
    id: z.string().uuid(),
    fullName: z.string().min(1).max(255).optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(["masculino", "feminino", "outro"]).optional(),
    careModality: z.enum(["AD", "ID"]).optional(),
    operatorId: z.string().uuid().optional(),
    admissionDate: z.string().optional(),
    attachments: z.string().optional(),
  })
);

export const useDeletePatient = routeAction$(
  async (data) => {
    const [existing] = await db.select().from(patients).where(eq(patients.id, data.id));
    if (!existing) return { success: false, message: "Paciente não encontrado." };
    await db.update(patients).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(patients.id, data.id));
    await logDelete("patients", data.id, existing as any);
    return { success: true, message: "Paciente removido." };
  },
  zod$({ id: z.string().uuid() })
);

export const useToggleActive = routeAction$(
  async (data) => {
    const [existing] = await db.select().from(patients).where(eq(patients.id, data.id));
    if (!existing) return { success: false, message: "Paciente não encontrado." };
    const [updated] = await db.update(patients).set({ active: !existing.active, updatedAt: new Date() }).where(eq(patients.id, data.id)).returning();
    await logUpdate("patients", data.id, existing as any, updated as any);
    return { success: true, message: updated.active ? "Paciente ativado!" : "Paciente desativado." };
  },
  zod$({ id: z.string().uuid() })
);

export const useRestorePatient = routeAction$(
  async (data) => {
    const [existing] = await db.select().from(patients).where(eq(patients.id, data.id));
    if (!existing) return { success: false, message: "Paciente não encontrado." };
    const [restored] = await db.update(patients).set({ deletedAt: null, updatedAt: new Date() }).where(eq(patients.id, data.id)).returning();
    await logRestore("patients", data.id, existing as any, restored as any);
    return { success: true, message: "Paciente restaurado!" };
  },
  zod$({ id: z.string().uuid() })
);

// ── Component ────────────────────────────────────────────
export default component$(() => {
  const patientsData = usePatients();
  const operatorOptions = useOperatorOptions();
  const createAction = useCreatePatient();
  const updateAction = useUpdatePatient();
  const deleteAction = useDeletePatient();
  const toggleAction = useToggleActive();
  const restoreAction = useRestorePatient();

  const showCreateModal = useSignal(false);
  const editingPatient = useSignal<any>(null);
  const deletingId = useSignal<string | null>(null);
  const toasts = useStore<{ items: ToastData[] }>({ items: [] });

  // Combobox search (frontend filter)
  const searchQuery = useSignal("");
  const selectedOperatorId = useSignal("");
  const editOperatorId = useSignal("");
  const uploadedFiles = useSignal<UploadedFile[]>([]);

  const addToast = $((type: ToastData["type"], title: string) => {
    toasts.items = [...toasts.items, createToast(type, title)];
  });

  const dismissToast = $((id: string) => {
    toasts.items = toasts.items.filter((t) => t.id !== id);
  });

  const { data, totalCount, page, pageSize } = patientsData.value;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const GENDER_LABELS: Record<string, string> = { masculino: "Masculino", feminino: "Feminino", outro: "Outro" };

  // Build combobox options for all patients (for search)
  const patientSearchOptions: ComboboxOption[] = data.map((p: any) => ({
    value: p.id,
    label: p.fullName,
  }));

  // Build operator combobox options
  const operatorComboOptions: ComboboxOption[] = operatorOptions.value.map((op) => ({
    value: op.id,
    label: op.name,
  }));

  // Frontend filtered patients
  const filteredData = searchQuery.value
    ? data.filter((p: any) =>
        p.fullName.toLowerCase().includes(searchQuery.value.toLowerCase())
      )
    : data;

  return (
    <div class="space-y-6">
      <ToastContainer toasts={toasts.items} onDismiss$={dismissToast} />

      {/* Header */}
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="m-0 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Pacientes</h1>
          <p class="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Gerencie o cadastro de pacientes
          </p>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          onClick$={() => {
            selectedOperatorId.value = operatorOptions.value[0]?.id || "";
            uploadedFiles.value = [];
            showCreateModal.value = true;
          }}
        >
          <LuPlus style={{ width: "18px", height: "18px" }} />
          Novo Paciente
        </button>
      </div>

      {/* Search & Filters */}
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-full max-w-xs">
          <Combobox
            options={patientSearchOptions}
            value=""
            placeholder="Buscar paciente..."
            onChange$={(val) => {
              // Navigate to filtered if selected, or just search
              if (val) {
                searchQuery.value = data.find((p: any) => p.id === val)?.fullName || "";
              }
            }}
            onSearch$={(q) => { searchQuery.value = q; }}
            id="patient-search"
          />
        </div>
        <form class="flex items-center gap-2">
          <select name="careModality" class="input select" style={{ width: "auto" }}>
            <option value="">Modalidade</option>
            <option value="AD">AD</option>
            <option value="ID">ID</option>
          </select>
          <select name="active" class="input select" style={{ width: "auto" }}>
            <option value="">Status</option>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
          <button type="submit" class="btn btn-secondary">Filtrar</button>
        </form>
      </div>

      {/* Card Grid */}
      {filteredData.length === 0 ? (
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <LuUsers style={{ width: "48px", height: "48px", color: "var(--text-tertiary)", marginBottom: "12px" }} />
          <p class="text-base font-medium" style={{ color: "var(--text-secondary)" }}>Nenhum paciente encontrado</p>
          <p class="text-sm" style={{ color: "var(--text-tertiary)" }}>Clique em "Novo Paciente" para começar.</p>
        </div>
      ) : (
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredData.map((p: any) => (
            <div
              key={p.id}
              class="card p-4"
              style={{
                opacity: p.deletedAt ? 0.6 : 1,
                borderLeft: `3px solid ${p.active ? "var(--color-success)" : "var(--color-warning)"}`,
              }}
            >
              {/* Card Header */}
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1 min-w-0">
                  <h3 class="m-0 text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {p.fullName}
                  </h3>
                  <p class="m-0 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {GENDER_LABELS[p.gender]}
                  </p>
                </div>
                <div class="flex items-center gap-1 ml-2">
                  <ModalityBadge modality={p.careModality} />
                </div>
              </div>

              {/* Card Body */}
              <div class="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <div class="flex items-center justify-between">
                  <span>Operadora</span>
                  <span class="font-medium" style={{ color: "var(--text-primary)" }}>{p.operator?.name || "—"}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>Nascimento</span>
                  <span>{new Date(p.dateOfBirth).toLocaleDateString("pt-BR")}</span>
                </div>
                {p.admissionDate && (
                  <div class="flex items-center justify-between">
                    <span class="flex items-center gap-1">
                      <LuCalendar style={{ width: "12px", height: "12px" }} />
                      Admissão
                    </span>
                    <span>{new Date(p.admissionDate).toLocaleDateString("pt-BR")}</span>
                  </div>
                )}
                <div class="flex items-center justify-between">
                  <span>Status</span>
                  {p.deletedAt ? (
                    <span class="badge badge-danger">
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "currentColor" }} />
                      Removido
                    </span>
                  ) : (
                    <StatusBadge active={p.active} />
                  )}
                </div>
                {p.attachments && p.attachments.length > 0 && (
                  <div class="flex items-center justify-between">
                    <span>Anexos</span>
                    <span class="badge badge-neutral">{p.attachments.length} arquivo{p.attachments.length > 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div class="flex items-center justify-end gap-1 mt-3 pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
                {!p.deletedAt ? (
                  <>
                    <button type="button" class="btn btn-ghost btn-icon btn-sm" title="Editar"
                      onClick$={() => {
                        editingPatient.value = p;
                        editOperatorId.value = p.operatorId;
                        uploadedFiles.value = p.attachments || [];
                      }}
                    >
                      <LuPencil style={{ width: "15px", height: "15px" }} />
                    </button>
                    <button type="button" class="btn btn-ghost btn-icon btn-sm" title={p.active ? "Desativar" : "Ativar"}
                      onClick$={async () => {
                        const result = await toggleAction.submit({ id: p.id });
                        if (result.value.success) addToast("success", result.value.message);
                      }}
                    >
                      {p.active ? <LuToggleRight style={{ width: "18px", height: "18px", color: "var(--color-success)" }} /> : <LuToggleLeft style={{ width: "18px", height: "18px", color: "var(--text-tertiary)" }} />}
                    </button>
                    <button type="button" class="btn btn-ghost btn-icon btn-sm" title="Remover" style={{ color: "var(--color-danger)" }}
                      onClick$={() => (deletingId.value = p.id)}
                    >
                      <LuTrash2 style={{ width: "15px", height: "15px" }} />
                    </button>
                  </>
                ) : (
                  <button type="button" class="btn btn-ghost btn-sm"
                    onClick$={async () => {
                      const result = await restoreAction.submit({ id: p.id });
                      if (result.value.success) addToast("success", result.value.message);
                    }}
                  >
                    <LuRotateCcw style={{ width: "15px", height: "15px" }} />
                    Restaurar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div class="flex items-center justify-between">
          <span class="text-sm" style={{ color: "var(--text-secondary)" }}>{totalCount} paciente{totalCount !== 1 ? "s" : ""}</span>
          <div class="flex items-center gap-1">
            <a href={`?page=${Math.max(1, page - 1)}`} class={`btn btn-ghost btn-sm btn-icon ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}><LuChevronLeft style={{ width: "16px", height: "16px" }} /></a>
            <span class="px-3 text-sm" style={{ color: "var(--text-secondary)" }}>{page} / {totalPages}</span>
            <a href={`?page=${Math.min(totalPages, page + 1)}`} class={`btn btn-ghost btn-sm btn-icon ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}><LuChevronRight style={{ width: "16px", height: "16px" }} /></a>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal.value} onClose$={() => (showCreateModal.value = false)} title="Novo Paciente" size="md">
        <form preventdefault:submit onSubmit$={async (e) => {
          const fd = new FormData(e.target as HTMLFormElement);
          const payload = {
            fullName: fd.get("fullName") as string,
            dateOfBirth: fd.get("dateOfBirth") as string,
            gender: fd.get("gender") as string,
            careModality: fd.get("careModality") as string,
            operatorId: selectedOperatorId.value,
            admissionDate: (fd.get("admissionDate") as string) || undefined,
            attachments: uploadedFiles.value.length > 0 ? JSON.stringify(uploadedFiles.value) : undefined,
          };
          const result = await createAction.submit(payload);
          if (result.value.success) { showCreateModal.value = false; addToast("success", result.value.message); }
          else addToast("error", result.value.message);
        }}>
          <div class="space-y-4">
            <div>
              <label class="label" for="p-name">Nome Completo <span style={{ color: "var(--color-danger)" }}>*</span></label>
              <input id="p-name" name="fullName" type="text" class="input" required />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label" for="p-dob">Data de Nascimento <span style={{ color: "var(--color-danger)" }}>*</span></label>
                <input id="p-dob" name="dateOfBirth" type="date" class="input" required />
              </div>
              <div>
                <label class="label" for="p-admission">Data de Admissão</label>
                <input id="p-admission" name="admissionDate" type="date" class="input" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label" for="p-gender">Sexo <span style={{ color: "var(--color-danger)" }}>*</span></label>
                <select id="p-gender" name="gender" class="input select">
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label class="label" for="p-modality">Modalidade <span style={{ color: "var(--color-danger)" }}>*</span></label>
                <select id="p-modality" name="careModality" class="input select">
                  <option value="AD">AD — Atenção Domiciliar</option>
                  <option value="ID">ID — Internação Domiciliar</option>
                </select>
              </div>
            </div>
            <div>
              <Combobox
                options={operatorComboOptions}
                value={selectedOperatorId.value}
                onChange$={(val) => { selectedOperatorId.value = val; }}
                placeholder="Buscar operadora..."
                label="Operadora *"
                id="p-operator"
                name="operatorId"
                required
              />
            </div>
            <FileUpload
              label="Anexos"
              value={uploadedFiles.value}
              onChange$={(files) => { uploadedFiles.value = files; }}
              maxSizeMB={5}
              multiple
            />
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="btn btn-secondary" onClick$={() => (showCreateModal.value = false)}>Cancelar</button>
              <button type="submit" class="btn btn-primary" disabled={createAction.isRunning}>
                {createAction.isRunning ? "Cadastrando..." : "Cadastrar"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingPatient.value} onClose$={() => (editingPatient.value = null)} title="Editar Paciente" size="md">
        <form preventdefault:submit onSubmit$={async (e) => {
          if (!editingPatient.value) return;
          const fd = new FormData(e.target as HTMLFormElement);
          const payload = {
            id: editingPatient.value.id,
            fullName: fd.get("fullName") as string,
            dateOfBirth: fd.get("dateOfBirth") as string,
            gender: fd.get("gender") as string,
            careModality: fd.get("careModality") as string,
            operatorId: editOperatorId.value,
            admissionDate: (fd.get("admissionDate") as string) || undefined,
            attachments: uploadedFiles.value.length > 0 ? JSON.stringify(uploadedFiles.value) : undefined,
          };
          const result = await updateAction.submit(payload);
          if (result.value.success) { editingPatient.value = null; addToast("success", result.value.message); }
          else addToast("error", result.value.message);
        }}>
          <div class="space-y-4">
            <div>
              <label class="label" for="ep-name">Nome Completo <span style={{ color: "var(--color-danger)" }}>*</span></label>
              <input id="ep-name" name="fullName" type="text" class="input" value={editingPatient.value?.fullName} required />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label" for="ep-dob">Data de Nascimento <span style={{ color: "var(--color-danger)" }}>*</span></label>
                <input id="ep-dob" name="dateOfBirth" type="date" class="input" value={editingPatient.value?.dateOfBirth?.split("T")[0]} required />
              </div>
              <div>
                <label class="label" for="ep-admission">Data de Admissão</label>
                <input id="ep-admission" name="admissionDate" type="date" class="input" value={editingPatient.value?.admissionDate?.split("T")[0] || ""} />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label" for="ep-gender">Sexo <span style={{ color: "var(--color-danger)" }}>*</span></label>
                <select id="ep-gender" name="gender" class="input select" value={editingPatient.value?.gender}>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label class="label" for="ep-modality">Modalidade <span style={{ color: "var(--color-danger)" }}>*</span></label>
                <select id="ep-modality" name="careModality" class="input select" value={editingPatient.value?.careModality}>
                  <option value="AD">AD</option>
                  <option value="ID">ID</option>
                </select>
              </div>
            </div>
            <div>
              <Combobox
                options={operatorComboOptions}
                value={editOperatorId.value}
                onChange$={(val) => { editOperatorId.value = val; }}
                placeholder="Buscar operadora..."
                label="Operadora *"
                id="ep-operator"
                name="operatorId"
                required
              />
            </div>
            <FileUpload
              label="Anexos"
              value={uploadedFiles.value}
              onChange$={(files) => { uploadedFiles.value = files; }}
              maxSizeMB={5}
              multiple
            />
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="btn btn-secondary" onClick$={() => (editingPatient.value = null)}>Cancelar</button>
              <button type="submit" class="btn btn-primary" disabled={updateAction.isRunning}>{updateAction.isRunning ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog isOpen={!!deletingId.value} title="Remover Paciente" message="Tem certeza que deseja remover este paciente? A operação pode ser revertida."
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
  title: "Pacientes — HealthPanel",
  meta: [{ name: "description", content: "Gerencie o cadastro de pacientes." }],
};
