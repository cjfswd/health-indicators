import { component$, Slot, useSignal } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$, useLocation } from "@builder.io/qwik-city";
import { Sidebar } from "~/components/ui/sidebar";
import { Header } from "~/components/ui/header";
import { getSession, type UserSession } from "~/lib/auth";
import { isAdmin } from "~/lib/permissions";

// Global loader: reads session from cookie, redirects to login if not authenticated
export const useUserSession = routeLoader$(async ({ cookie, pathname, redirect }) => {
  const session = getSession(cookie);

  // Allow login page without auth
  if (pathname.startsWith("/login")) {
    if (session) throw redirect(302, "/"); // already logged in → go to dashboard
    return { email: null, name: null, picture: null, isAdmin: false };
  }

  // Protect all other routes
  if (!session) {
    throw redirect(302, "/login/");
  }

  return {
    email: session.email,
    name: session.name,
    picture: session.picture,
    isAdmin: isAdmin(session.email),
  };
});

export default component$(() => {
  const sidebarOpen = useSignal(false);
  const sidebarCollapsed = useSignal(false);
  const session = useUserSession();
  const loc = useLocation();

  // Login page uses its own layout — just render the slot
  if (loc.url.pathname.startsWith("/login")) {
    return <Slot />;
  }

  return (
    <div class="flex h-screen overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen.value}
        collapsed={sidebarCollapsed.value}
        isAdmin={session.value.isAdmin}
        onClose$={() => (sidebarOpen.value = false)}
        onToggleCollapse$={() => (sidebarCollapsed.value = !sidebarCollapsed.value)}
      />

      <div class="flex flex-1 flex-col overflow-hidden">
        <Header
          onMenuToggle$={() => (sidebarOpen.value = !sidebarOpen.value)}
          userEmail={session.value.email || ""}
          userName={session.value.name || ""}
          userPicture={session.value.picture || ""}
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
  title: "Health Indicators — Gestão de Saúde Domiciliar",
  meta: [
    {
      name: "description",
      content:
        "Painel de gestão de saúde domiciliar com indicadores, pacientes, operadoras e eventos.",
    },
  ],
};
