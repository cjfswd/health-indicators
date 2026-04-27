import { component$, Slot, useSignal } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { Sidebar } from "~/components/ui/sidebar";
import { Header } from "~/components/ui/header";

export default component$(() => {
  const sidebarOpen = useSignal(false);
  const sidebarCollapsed = useSignal(false);

  return (
    <div class="flex h-screen overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen.value}
        collapsed={sidebarCollapsed.value}
        onClose$={() => (sidebarOpen.value = false)}
        onToggleCollapse$={() => (sidebarCollapsed.value = !sidebarCollapsed.value)}
      />

      <div class="flex flex-1 flex-col overflow-hidden">
        <Header
          onMenuToggle$={() => (sidebarOpen.value = !sidebarOpen.value)}
        />

        <main
          class="flex-1 overflow-y-auto p-4 lg:p-6"
          style={{ background: "var(--bg-app)" }}
        >
          <div class="mx-auto max-w-7xl page-enter">
            <Slot />
          </div>
        </main>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "HealthPanel — Gestão de Saúde Domiciliar",
  meta: [
    {
      name: "description",
      content:
        "Painel de gestão de saúde domiciliar com indicadores, pacientes, operadoras e eventos para relatórios C-level.",
    },
  ],
};
