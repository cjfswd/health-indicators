import { Slot, component$ } from "@builder.io/qwik";

/**
 * Login layout — no sidebar, full-screen centered.
 */
export default component$(() => {
  return (
    <div
      class="flex min-h-screen items-center justify-center"
      style={{
        background: "linear-gradient(135deg, var(--bg-app) 0%, var(--bg-card) 100%)",
      }}
    >
      <Slot />
    </div>
  );
});
