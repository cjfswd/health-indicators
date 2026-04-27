import {
  component$,
  useSignal,
  useComputed$,
  type QRL,
  type JSXOutput,
} from "@builder.io/qwik";
import { LuChevronUp, LuChevronDown, LuSearch, LuChevronLeft, LuChevronRight, LuChevronsLeft, LuChevronsRight, LuInbox } from "@qwikest/icons/lucide";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: QRL<(row: T) => JSXOutput>;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange$: QRL<(page: number) => void>;
  onSort$?: QRL<(key: string, direction: "asc" | "desc") => void>;
  searchValue?: string;
  onSearch$?: QRL<(value: string) => void>;
  searchPlaceholder?: string;
  loading?: boolean;
  filterSlot?: JSXOutput;
}

export const DataTable = component$<DataTableProps<any>>((props) => {
  const sortKey = useSignal("");
  const sortDir = useSignal<"asc" | "desc">("asc");

  const totalPages = useComputed$(() =>
    Math.max(1, Math.ceil(props.totalCount / props.pageSize))
  );

  const pageNumbers = useComputed$(() => {
    const total = totalPages.value;
    const current = props.page;
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  return (
    <div class="space-y-4">
      {/* Toolbar: Search + Filters */}
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {props.onSearch$ && (
          <div class="relative w-full sm:max-w-xs">
            <LuSearch
              style={{
                width: "16px",
                height: "16px",
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-tertiary)",
              }}
            />
            <input
              type="text"
              class="input"
              style={{ paddingLeft: "36px" }}
              placeholder={props.searchPlaceholder || "Buscar..."}
              value={props.searchValue || ""}
              onInput$={(e) => {
                const target = e.target as HTMLInputElement;
                props.onSearch$?.(target.value);
              }}
            />
          </div>
        )}
        {props.filterSlot && (
          <div class="flex flex-wrap items-center gap-2">
            {props.filterSlot}
          </div>
        )}
      </div>

      {/* Table */}
      <div class="table-container">
        {props.loading ? (
          <div class="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} class="skeleton" style={{ height: "40px" }} />
            ))}
          </div>
        ) : props.data.length === 0 ? (
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <LuInbox
              style={{
                width: "48px",
                height: "48px",
                color: "var(--text-tertiary)",
                marginBottom: "12px",
              }}
            />
            <p
              class="text-base font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Nenhum registro encontrado
            </p>
            <p class="text-sm" style={{ color: "var(--text-tertiary)" }}>
              Tente ajustar os filtros ou crie um novo registro.
            </p>
          </div>
        ) : (
          <table class="data-table">
            <thead>
              <tr>
                {props.columns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    onClick$={() => {
                      if (!col.sortable) return;
                      const newDir =
                        sortKey.value === col.key && sortDir.value === "asc"
                          ? "desc"
                          : "asc";
                      sortKey.value = col.key;
                      sortDir.value = newDir;
                      props.onSort$?.(col.key, newDir);
                    }}
                  >
                    <div class="flex items-center gap-1">
                      {col.label}
                      {col.sortable && sortKey.value === col.key && (
                        sortDir.value === "asc" ? (
                          <LuChevronUp style={{ width: "14px", height: "14px" }} />
                        ) : (
                          <LuChevronDown style={{ width: "14px", height: "14px" }} />
                        )
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.data.map((row: any, i: number) => (
                <tr key={row.id || i}>
                  {props.columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row) : (row as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {props.totalCount > 0 && (
        <div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <span class="text-sm" style={{ color: "var(--text-secondary)" }}>
            Mostrando {Math.min((props.page - 1) * props.pageSize + 1, props.totalCount)}–
            {Math.min(props.page * props.pageSize, props.totalCount)} de{" "}
            {props.totalCount} registros
          </span>

          <div class="flex items-center gap-1">
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-icon"
              disabled={props.page <= 1}
              onClick$={() => props.onPageChange$(1)}
              aria-label="Primeira página"
            >
              <LuChevronsLeft style={{ width: "16px", height: "16px" }} />
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-icon"
              disabled={props.page <= 1}
              onClick$={() => props.onPageChange$(props.page - 1)}
              aria-label="Página anterior"
            >
              <LuChevronLeft style={{ width: "16px", height: "16px" }} />
            </button>

            {pageNumbers.value.map((num) => (
              <button
                key={num}
                type="button"
                class={`btn btn-sm ${num === props.page ? "btn-primary" : "btn-ghost"}`}
                onClick$={() => props.onPageChange$(num)}
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              class="btn btn-ghost btn-sm btn-icon"
              disabled={props.page >= totalPages.value}
              onClick$={() => props.onPageChange$(props.page + 1)}
              aria-label="Próxima página"
            >
              <LuChevronRight style={{ width: "16px", height: "16px" }} />
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-icon"
              disabled={props.page >= totalPages.value}
              onClick$={() => props.onPageChange$(totalPages.value)}
              aria-label="Última página"
            >
              <LuChevronsRight style={{ width: "16px", height: "16px" }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
