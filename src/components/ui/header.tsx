import { component$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { LuMenu, LuChevronRight, LuLogOut } from "@qwikest/icons/lucide";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  onMenuToggle$: () => void;
  userEmail?: string;
  userName?: string;
  userPicture?: string;
}

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/pacientes/": "Pacientes",
  "/eventos/": "Eventos",
  "/metas/": "Metas",
  "/auditoria/": "Auditoria",
};

export const Header = component$<HeaderProps>(({ onMenuToggle$, userEmail, userName, userPicture }) => {
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
        {/* Mobile-only menu toggle — hidden on desktop */}
        <button
          type="button"
          class="btn btn-ghost btn-icon"
          onClick$={onMenuToggle$}
          aria-label="Abrir menu"
          id="menu-toggle"
        >
          <LuMenu style={{ width: "22px", height: "22px" }} />
        </button>

        {/* Breadcrumb */}
        <nav class="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
          <span style={{ color: "var(--text-tertiary)" }}>Health Indicators</span>
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

      <div class="flex items-center gap-3">
        {/* User info */}
        {userEmail && (
          <div class="hidden sm:flex items-center gap-2">
            {userPicture && (
              <img
                src={userPicture}
                alt={userName || userEmail}
                width={28}
                height={28}
                class="rounded-full"
                style={{ border: "2px solid var(--border-default)" }}
              />
            )}
            <div class="text-right">
              {userName && (
                <p class="m-0 text-xs font-medium" style={{ color: "var(--text-primary)", lineHeight: "1.2" }}>
                  {userName}
                </p>
              )}
              <p class="m-0 text-xs" style={{ color: "var(--text-tertiary)", lineHeight: "1.2" }}>
                {userEmail}
              </p>
            </div>
          </div>
        )}

        <ThemeToggle />

        {/* Logout */}
        {userEmail && (
          <form method="post" action="/api/auth/logout/">
            <button
              type="submit"
              class="btn btn-ghost btn-icon btn-sm"
              title="Sair"
              style={{ color: "var(--text-tertiary)" }}
            >
              <LuLogOut style={{ width: "18px", height: "18px" }} />
            </button>
          </form>
        )}
      </div>
    </header>
  );
});
