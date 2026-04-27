import { component$, useSignal, type QRL, useTask$ } from "@builder.io/qwik";
import { LuChevronsUpDown, LuCheck, LuX } from "@qwikest/icons/lucide";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  placeholder?: string;
  onChange$: QRL<(value: string) => void>;
  onSearch$?: QRL<(query: string) => void>;
  label?: string;
  id?: string;
  name?: string;
  required?: boolean;
}

export const Combobox = component$<ComboboxProps>((props) => {
  const isOpen = useSignal(false);
  const query = useSignal("");
  const highlightedIndex = useSignal(-1);

  const filteredOptions = props.options.filter((opt) =>
    opt.label.toLowerCase().includes(query.value.toLowerCase())
  );

  const selectedLabel =
    props.options.find((opt) => opt.value === props.value)?.label || "";

  return (
    <div class="relative">
      {props.label && (
        <label class="label" for={props.id}>
          {props.label}
        </label>
      )}

      <div class="relative">
        {/* Hidden input for FormData serialization */}
        {props.name && (
          <input type="hidden" name={props.name} value={props.value || ""} />
        )}
        <input
          id={props.id}
          type="text"
          class="input"
          style={{ paddingRight: "64px" }}
          placeholder={props.placeholder || "Selecionar..."}
          value={isOpen.value ? query.value : selectedLabel}
          onFocus$={() => {
            isOpen.value = true;
            query.value = "";
          }}
          onInput$={(e) => {
            const target = e.target as HTMLInputElement;
            query.value = target.value;
            props.onSearch$?.(target.value);
            highlightedIndex.value = 0;
          }}
          onKeyDown$={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              highlightedIndex.value = Math.min(
                highlightedIndex.value + 1,
                filteredOptions.length - 1
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
            } else if (e.key === "Enter" && highlightedIndex.value >= 0) {
              e.preventDefault();
              const opt = filteredOptions[highlightedIndex.value];
              if (opt) {
                props.onChange$(opt.value);
                isOpen.value = false;
              }
            } else if (e.key === "Escape") {
              isOpen.value = false;
            }
          }}
          onBlur$={() => {
            // Delay to allow click on option
            setTimeout(() => (isOpen.value = false), 200);
          }}
        />

        <div class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {props.value && (
            <button
              type="button"
              class="btn btn-ghost btn-icon btn-sm"
              onClick$={() => {
                props.onChange$("");
                query.value = "";
              }}
              aria-label="Limpar seleção"
            >
              <LuX style={{ width: "14px", height: "14px" }} />
            </button>
          )}
          <LuChevronsUpDown
            style={{
              width: "16px",
              height: "16px",
              color: "var(--text-tertiary)",
              marginRight: "8px",
            }}
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen.value && (
        <div
          class="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border animate-scale-in"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-default)",
            boxShadow: "var(--shadow-lg)",
            maxHeight: "220px",
            overflowY: "auto",
          }}
        >
          {filteredOptions.length === 0 ? (
            <div
              class="px-4 py-3 text-sm"
              style={{ color: "var(--text-tertiary)" }}
            >
              Nenhum resultado encontrado
            </div>
          ) : (
            filteredOptions.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors"
                style={{
                  background:
                    i === highlightedIndex.value
                      ? "var(--bg-hover)"
                      : opt.value === props.value
                        ? "var(--bg-active)"
                        : "transparent",
                  color:
                    opt.value === props.value
                      ? "var(--text-accent)"
                      : "var(--text-primary)",
                }}
                onClick$={() => {
                  props.onChange$(opt.value);
                  isOpen.value = false;
                }}
                onMouseEnter$={() => (highlightedIndex.value = i)}
              >
                {opt.value === props.value && (
                  <LuCheck style={{ width: "16px", height: "16px", flexShrink: 0 }} />
                )}
                <span class={opt.value === props.value ? "" : "pl-6"}>
                  {opt.label}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
