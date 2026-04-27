import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { LuSun, LuMoon } from "@qwikest/icons/lucide";

export const ThemeToggle = component$(() => {
  const isDark = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      isDark.value = true;
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  });

  return (
    <button
      id="theme-toggle"
      type="button"
      class="btn btn-ghost btn-icon"
      aria-label={isDark.value ? "Mudar para tema claro" : "Mudar para tema escuro"}
      onClick$={() => {
        isDark.value = !isDark.value;
        const theme = isDark.value ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
      }}
    >
      {isDark.value ? (
        <LuSun style={{ width: "20px", height: "20px" }} />
      ) : (
        <LuMoon style={{ width: "20px", height: "20px" }} />
      )}
    </button>
  );
});
