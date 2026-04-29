import { component$, useSignal, useStore, $ } from "@builder.io/qwik";
import {
  type DocumentHead,
  routeLoader$,
  routeAction$,
  zod$,
  z,
} from "@builder.io/qwik-city";
import { eq, and, isNull, like, sql, asc } from "drizzle-orm";
import { db } from "~/db/dev-database";
import { healthOperators } from "~/db/schema";
import { logCreate, logUpdate } from "~/lib/ledger";
import { Modal } from "~/components/ui/modal";
import { ToastContainer, createToast, type ToastData } from "~/components/ui/toast";
import { FileUpload, type UploadedFile } from "~/components/ui/file-upload";
import {
  LuPlus,
  LuPencil,
  LuSearch,
  LuBuilding2,
  LuChevronLeft,
  LuChevronRight,
} from "@qwikest/icons/lucide";

// ── Data Loader ──────────────────────────────────────────
export const useOperators = routeLoader$(async ({ query }) => {
  const page = parseInt(query.get("page") || "1");
  const pageSize = parseInt(query.get("pageSize") || "15");
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
    db.select().from(healthOperators).where(where).orderBy(asc(healthOperators.name)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(healthOperators).where(where),
  ]);

  return {
    data: data.map((d) => ({
      ...d,
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

// ── Actions ──────────────────────────────────────────────
export const useCreateOperator = routeAction$(
  async (data) => {
    try {
      const [created] = await db.insert(healthOperators).values({
        name: data.name,
        attachments: data.attachments ? JSON.parse(data.attachments) : [],
      }).returning();
      await logCreate("health_operators", created as any);
      return { success: true, message: "Operadora criada com sucesso!" };
    } catch (e: any) {
      if (e.message?.includes("unique")) {
        return { success: false, message: "Operadora com este nome já existe." };
      }
      return { success: false, message: "Erro ao criar operadora." };
    }
  },
  zod$({
    name: z.string().min(1, "Nome é obrigatório").max(255),
    attachments: z.string().optional(),
  })
);

export const useUpdateOperator = routeAction$(
  async (data) => {
    const [existing] = await db.select().from(healthOperators).where(eq(healthOperators.id, data.id));
    if (!existing) return { success: false, message: "Operadora não encontrada." };

    const updateData: any = { name: data.name, updatedAt: new Date() };
    if (data.attachments) updateData.attachments = JSON.parse(data.attachments);

    const [updated] = await db.update(healthOperators).set(updateData).where(eq(healthOperators.id, data.id)).returning();
    await logUpdate("health_operators", data.id, existing as any, updated as any);
    return { success: true, message: "Operadora atualizada!" };
  },
  zod$({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    attachments: z.string().optional(),
  })
);



// ── Component ────────────────────────────────────────────
export default component$(() => {
  const operators = useOperators();
  const createAction = useCreateOperator();
  const updateAction = useUpdateOperator();

  const showCreateModal = useSignal(false);
  const editingId = useSignal<string | null>(null);
  const toasts = useStore<{ items: ToastData[] }>({ items: [] });

  const editName = useSignal("");
  const createName = useSignal("");
  const uploadedFiles = useSignal<UploadedFile[]>([]);

  const addToast = $((type: ToastData["type"], title: string, message?: string) => {
    toasts.items = [...toasts.items, createToast(type, title, message)];
  });

  const dismissToast = $((id: string) => {
    toasts.items = toasts.items.filter((t) => t.id !== id);
  });

  const { data, totalCount, page, pageSize } = operators.value;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div class="space-y-6">
      <ToastContainer toasts={toasts.items} onDismiss$={dismissToast} />

      {/* Header */}
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="m-0 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Operadoras
          </h1>
          <p class="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Gerencie as operadoras de saúde (convênios)
          </p>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          onClick$={() => {
            createName.value = "";
            uploadedFiles.value = [];
            showCreateModal.value = true;
          }}
        >
          <LuPlus style={{ width: "18px", height: "18px" }} />
          Nova Operadora
        </button>
      </div>

      {/* Search */}
      <div class="flex items-center gap-3">
        <div class="relative w-full max-w-sm">
          <LuSearch
            style={{
              width: "16px", height: "16px",
              position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
              color: "var(--text-tertiary)",
            }}
          />
          <form>
            <input
              name="search"
              type="text"
              class="input"
              style={{ paddingLeft: "36px" }}
              placeholder="Buscar operadora..."
            />
          </form>
        </div>
      </div>

      {/* Table */}
      <div class="table-container">
        {data.length === 0 ? (
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <LuBuilding2
              style={{ width: "48px", height: "48px", color: "var(--text-tertiary)", marginBottom: "12px" }}
            />
            <p class="text-base font-medium" style={{ color: "var(--text-secondary)" }}>
              Nenhuma operadora cadastrada
            </p>
            <p class="text-sm" style={{ color: "var(--text-tertiary)" }}>
              Clique em "Nova Operadora" para começar.
            </p>
          </div>
        ) : (
          <table class="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th style={{ width: "180px" }}>Criado em</th>
                <th style={{ width: "120px" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((op) => (
                <tr key={op.id}>
                  <td>
                    <div class="flex items-center gap-3">
                      <div
                        class="flex items-center justify-center rounded-lg"
                        style={{ width: "32px", height: "32px", background: "var(--bg-active)", color: "var(--text-accent)" }}
                      >
                        <LuBuilding2 style={{ width: "16px", height: "16px" }} />
                      </div>
                      <span class="font-medium">{op.name}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>
                    {new Date(op.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td>
                    <button
                      type="button"
                      class="btn btn-ghost btn-icon btn-sm"
                      title="Editar"
                      onClick$={() => {
                        editingId.value = op.id;
                        editName.value = op.name;
                        uploadedFiles.value = op.attachments || [];
                      }}
                    >
                      <LuPencil style={{ width: "15px", height: "15px" }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div class="flex items-center justify-between">
          <span class="text-sm" style={{ color: "var(--text-secondary)" }}>
            {totalCount} operadora{totalCount !== 1 ? "s" : ""}
          </span>
          <div class="flex items-center gap-1">
            <a
              href={`?page=${Math.max(1, page - 1)}`}
              class={`btn btn-ghost btn-sm btn-icon ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
            >
              <LuChevronLeft style={{ width: "16px", height: "16px" }} />
            </a>
            <span class="px-3 text-sm" style={{ color: "var(--text-secondary)" }}>
              {page} / {totalPages}
            </span>
            <a
              href={`?page=${Math.min(totalPages, page + 1)}`}
              class={`btn btn-ghost btn-sm btn-icon ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
            >
              <LuChevronRight style={{ width: "16px", height: "16px" }} />
            </a>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal.value && (
        <Modal
          isOpen={showCreateModal.value}
          onClose$={() => (showCreateModal.value = false)}
          title="Nova Operadora"
          size="sm"
        >
          <form
            preventdefault:submit
            onSubmit$={async () => {
              try {
                const result = await createAction.submit({
                  name: createName.value,
                  attachments: uploadedFiles.value.length > 0 ? JSON.stringify(uploadedFiles.value) : undefined,
                });
                if (result.value?.success) {
                  showCreateModal.value = false;
                  createName.value = "";
                  uploadedFiles.value = [];
                  addToast("success", result.value.message);
                } else if (result.value?.message) {
                  addToast("error", result.value.message);
                } else {
                  // Zod validation failure — extract field errors
                  const val = result.value as any;
                  if (val?.fieldErrors) {
                    const msgs = Object.values(val.fieldErrors).flat().join(", ");
                    addToast("error", "Erro de validação", msgs);
                  } else {
                    addToast("error", "Erro ao criar operadora.", "Verifique os dados e tente novamente.");
                  }
                }
              } catch (err: any) {
                addToast("error", "Erro inesperado", err?.message || "Tente novamente.");
              }
            }}
          >
            <div class="space-y-4">
              <div>
                <label class="label" for="operator-name">Nome da Operadora <span style={{ color: "var(--color-danger)" }}>*</span></label>
                <input
                  id="operator-name"
                  type="text"
                  class="input"
                  placeholder="Ex: Unimed, Camperj..."
                  bind:value={createName}
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
                <button
                  type="button"
                  class="btn btn-secondary"
                  onClick$={() => (showCreateModal.value = false)}
                >
                  Cancelar
                </button>
                <button type="submit" class="btn btn-primary" disabled={createAction.isRunning}>
                  {createAction.isRunning ? "Criando..." : "Criar Operadora"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingId.value}
        onClose$={() => (editingId.value = null)}
        title="Editar Operadora"
        size="sm"
      >
        <form
          preventdefault:submit
          onSubmit$={async () => {
            if (!editingId.value) return;
            const result = await updateAction.submit({
              id: editingId.value,
              name: editName.value,
              attachments: uploadedFiles.value.length > 0 ? JSON.stringify(uploadedFiles.value) : undefined,
            });
            if (result.value.success) {
              editingId.value = null;
              addToast("success", result.value.message);
            } else {
              addToast("error", result.value.message);
            }
          }}
        >
          <div class="space-y-4">
            <div>
              <label class="label" for="edit-operator-name">Nome da Operadora <span style={{ color: "var(--color-danger)" }}>*</span></label>
              <input
                id="edit-operator-name"
                type="text"
                class="input"
                bind:value={editName}
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
              <button type="button" class="btn btn-secondary" onClick$={() => (editingId.value = null)}>
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary" disabled={updateAction.isRunning}>
                {updateAction.isRunning ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </form>
      </Modal>


    </div>
  );
});

export const head: DocumentHead = {
  title: "Operadoras — Health Indicators",
  meta: [{ name: "description", content: "Gerencie as operadoras de saúde (convênios)." }],
};
