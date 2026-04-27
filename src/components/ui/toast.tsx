import { component$, useSignal, useVisibleTask$, type QRL } from "@builder.io/qwik";
import { LuCheckCircle, LuXCircle, LuAlertTriangle, LuInfo, LuX } from "@qwikest/icons/lucide";

export interface ToastData {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}

interface ToastItemProps {
  toast: ToastData;
  onDismiss$: QRL<(id: string) => void>;
}

const ICON_STYLE = { width: "20px", height: "20px", flexShrink: 0 };

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  success: {
    bg: "oklch(0.62 0.17 145 / 0.08)",
    border: "oklch(0.62 0.17 145 / 0.3)",
    icon: "var(--color-success)",
  },
  error: {
    bg: "oklch(0.58 0.2 25 / 0.08)",
    border: "oklch(0.58 0.2 25 / 0.3)",
    icon: "var(--color-danger)",
  },
  warning: {
    bg: "oklch(0.75 0.16 70 / 0.08)",
    border: "oklch(0.75 0.16 70 / 0.3)",
    icon: "var(--color-warning)",
  },
  info: {
    bg: "oklch(0.62 0.15 250 / 0.08)",
    border: "oklch(0.62 0.15 250 / 0.3)",
    icon: "var(--color-info)",
  },
};

const ToastItem = component$<ToastItemProps>(({ toast, onDismiss$ }) => {
  const style = TYPE_STYLES[toast.type];

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const timer = setTimeout(
      () => onDismiss$(toast.id),
      toast.duration || 4000
    );
    cleanup(() => clearTimeout(timer));
  });

  return (
    <div
      class="flex items-start gap-3 rounded-xl border px-4 py-3 animate-slide-in-right"
      style={{
        background: style.bg,
        borderColor: style.border,
        backdropFilter: "blur(12px)",
        minWidth: "320px",
        maxWidth: "420px",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div style={{ color: style.icon, marginTop: "2px" }}>
        {toast.type === "success" && <LuCheckCircle style={ICON_STYLE} />}
        {toast.type === "error" && <LuXCircle style={ICON_STYLE} />}
        {toast.type === "warning" && <LuAlertTriangle style={ICON_STYLE} />}
        {toast.type === "info" && <LuInfo style={ICON_STYLE} />}
      </div>

      <div class="flex-1 min-w-0">
        <p class="m-0 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {toast.title}
        </p>
        {toast.message && (
          <p class="m-0 mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            {toast.message}
          </p>
        )}
      </div>

      <button
        type="button"
        class="btn btn-ghost btn-icon btn-sm"
        style={{ marginTop: "-2px", marginRight: "-4px" }}
        onClick$={() => onDismiss$(toast.id)}
        aria-label="Fechar notificação"
      >
        <LuX style={{ width: "14px", height: "14px" }} />
      </button>
    </div>
  );
});

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss$: QRL<(id: string) => void>;
}

export const ToastContainer = component$<ToastContainerProps>(
  ({ toasts, onDismiss$ }) => {
    if (toasts.length === 0) return null;

    return (
      <div
        class="fixed top-4 right-4 z-[100] flex flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss$={onDismiss$} />
        ))}
      </div>
    );
  }
);

/** Helper to create a toast with a unique ID */
export function createToast(
  type: ToastData["type"],
  title: string,
  message?: string,
  duration?: number
): ToastData {
  return {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    message,
    duration,
  };
}
