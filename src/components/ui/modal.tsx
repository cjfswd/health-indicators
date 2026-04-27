import { component$, Slot, type QRL } from "@builder.io/qwik";
import { LuX } from "@qwikest/icons/lucide";

interface ModalProps {
  isOpen: boolean;
  onClose$: QRL<() => void>;
  title: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_MAP: Record<string, string> = {
  sm: "420px",
  md: "560px",
  lg: "720px",
  xl: "900px",
};

export const Modal = component$<ModalProps>(({ isOpen, onClose$, title, size = "md" }) => {
  if (!isOpen) return null;

  return (
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "oklch(0 0 0 / 0.5)", backdropFilter: "blur(4px)" }}
      onClick$={(e) => {
        if ((e.target as HTMLElement).classList.contains("fixed")) {
          onClose$();
        }
      }}
      onKeyDown$={(e) => {
        if (e.key === "Escape") onClose$();
      }}
    >
      <div
        class="card w-full animate-scale-in"
        style={{
          maxWidth: SIZE_MAP[size],
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div
          class="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <h2 class="m-0 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <button
            type="button"
            class="btn btn-ghost btn-icon"
            onClick$={onClose$}
            aria-label="Fechar"
          >
            <LuX style={{ width: "20px", height: "20px" }} />
          </button>
        </div>

        {/* Body */}
        <div class="flex-1 overflow-y-auto px-6 py-5">
          <Slot />
        </div>
      </div>
    </div>
  );
});
