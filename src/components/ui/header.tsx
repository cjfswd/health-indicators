import { component$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { LuMenu, LuChevronRight } from "@qwikest/icons/lucide";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  onMenuToggle$: () => void;
}

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/pacientes/": "Pacientes",
  "/operadoras/": "Operadoras",
  "/eventos/": "Eventos",
  "/auditoria/": "Auditoria",
};

export const Header = component$<HeaderProps>(({ onMenuToggle$ }) => {
  const loc = useLocation();

  // Build breadcrumb
  const pathname = loc.url.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const pageTitle =
    ROUTE_LABELS[pathname] ||
    ROUTE_LABELS[`/${segments[0]}/`] ||
    "Página";

  return (
    <header
      class="sticky top-0 z-30 flex items-center justify-between border-b px-4 lg:px-6"
      style={{
        height: "var(--header-height)",
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div class="flex items-center gap-3">
        {/* Mobile-only menu toggle — hidden on desktop via lg:hidden */}
        <button
          type="button"
          class="btn btn-ghost btn-icon lg:hidden"
          onClick$={onMenuToggle$}
          aria-label="Abrir menu"
          id="menu-toggle"
        >
          <LuMenu style={{ width: "22px", height: "22px" }} />
        </button>

        {/* Breadcrumb */}
        <nav class="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
          <span style={{ color: "var(--text-tertiary)" }}>HealthPanel</span>
          {segments.length > 0 && (
            <>
              <LuChevronRight
                style={{
                  width: "14px",
                  height: "14px",
                  color: "var(--text-tertiary)",
                }}
              />
              <span class="font-medium" style={{ color: "var(--text-primary)" }}>
                {pageTitle}
              </span>
            </>
          )}
          {segments.length > 1 && (
            <>
              <LuChevronRight
                style={{
                  width: "14px",
                  height: "14px",
                  color: "var(--text-tertiary)",
                }}
              />
              <span class="font-medium" style={{ color: "var(--text-accent)" }}>
                Detalhes
              </span>
            </>
          )}
        </nav>
      </div>

      <div class="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
});
