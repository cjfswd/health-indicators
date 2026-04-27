import { component$, type QRL } from "@builder.io/qwik";
import { LuAlertTriangle } from "@qwikest/icons/lucide";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm$: QRL<() => void>;
  onCancel$: QRL<() => void>;
}

export const ConfirmDialog = component$<ConfirmDialogProps>(
  ({
    isOpen,
    title,
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    variant = "danger",
    onConfirm$,
    onCancel$,
  }) => {
    if (!isOpen) return null;

    return (
      <div
        class="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in"
        style={{ background: "oklch(0 0 0 / 0.5)", backdropFilter: "blur(4px)" }}
        onClick$={(e) => {
          if ((e.target as HTMLElement).classList.contains("fixed")) {
            onCancel$();
          }
        }}
        onKeyDown$={(e) => {
          if (e.key === "Escape") onCancel$();
        }}
      >
        <div
          class="card w-full animate-scale-in p-6"
          style={{ maxWidth: "420px" }}
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
        >
          <div class="flex items-start gap-4">
            <div
              class="flex items-center justify-center rounded-full p-2.5"
              style={{
                background:
                  variant === "danger"
                    ? "oklch(0.58 0.2 25 / 0.12)"
                    : "oklch(0.75 0.16 70 / 0.12)",
              }}
            >
              <LuAlertTriangle
                style={{
                  width: "24px",
                  height: "24px",
                  color:
                    variant === "danger"
                      ? "var(--color-danger)"
                      : "var(--color-warning)",
                }}
              />
            </div>

            <div class="flex-1">
              <h3
                class="m-0 text-base font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {title}
              </h3>
              <p
                class="mt-2 text-sm"
                style={{ color: "var(--text-secondary)", lineHeight: "1.5" }}
              >
                {message}
              </p>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="btn btn-secondary" onClick$={onCancel$}>
              {cancelLabel}
            </button>
            <button
              type="button"
              class={variant === "danger" ? "btn btn-danger" : "btn btn-primary"}
              onClick$={onConfirm$}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }
);
