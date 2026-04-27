import { component$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import {
  LuLayoutDashboard,
  LuUsers,
  LuBuilding2,
  LuCalendarClock,
  LuShieldCheck,
  LuActivity,
  LuChevronLeft,
  LuChevronRight,
} from "@qwikest/icons/lucide";

interface SidebarProps {
  isOpen: boolean;
  collapsed: boolean;
  onClose$: () => void;
  onToggleCollapse$: () => void;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/pacientes/", label: "Pacientes", icon: "users" },
  { href: "/operadoras/", label: "Operadoras", icon: "building" },
  { href: "/eventos/", label: "Eventos", icon: "calendar" },
  { href: "/auditoria/", label: "Auditoria", icon: "shield" },
] as const;

const IconMap = component$<{ name: string }>(({ name }) => {
  const style = { width: "20px", height: "20px" };
  switch (name) {
    case "dashboard":
      return <LuLayoutDashboard style={style} />;
    case "users":
      return <LuUsers style={style} />;
    case "building":
      return <LuBuilding2 style={style} />;
    case "calendar":
      return <LuCalendarClock style={style} />;
    case "shield":
      return <LuShieldCheck style={style} />;
    default:
      return null;
  }
});

export const Sidebar = component$<SidebarProps>(({ isOpen, collapsed, onClose$, onToggleCollapse$ }) => {
  const loc = useLocation();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick$={onClose$}
        />
      )}

      {/* Sidebar */}
      <aside
        class={[
          "fixed top-0 left-0 z-50 flex h-full flex-col border-r lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
        style={{
          width: collapsed ? "64px" : "var(--sidebar-width)",
          background: "var(--bg-sidebar)",
          borderColor: "var(--border-default)",
          transition: "width 0.25s ease, transform 0.3s ease",
        }}
      >
        {/* Logo */}
        <div
          class="flex items-center px-5"
          style={{
            height: "var(--header-height)",
            borderBottom: "1px solid var(--border-default)",
            justifyContent: collapsed ? "center" : "flex-start",
            overflow: "hidden",
          }}
        >
          <Link href="/" class="flex items-center gap-3 no-underline" onClick$={onClose$}>
            <div
              class="flex items-center justify-center rounded-xl"
              style={{
                width: "36px",
                height: "36px",
                minWidth: "36px",
                background: "linear-gradient(135deg, var(--color-primary-500), var(--color-accent-500))",
              }}
            >
              <LuActivity style={{ width: "20px", height: "20px", color: "white" }} />
            </div>
            {!collapsed && (
              <div>
                <h1
                  class="m-0 text-base font-bold"
                  style={{ color: "var(--text-primary)", lineHeight: "1.2", whiteSpace: "nowrap" }}
                >
                  HealthPanel
                </h1>
                <span
                  class="text-xs"
                  style={{ color: "var(--text-tertiary)", whiteSpace: "nowrap" }}
                >
                  Gestão Domiciliar
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav class="flex-1 overflow-y-auto px-2 py-4" style={{ paddingLeft: collapsed ? "8px" : undefined, paddingRight: collapsed ? "8px" : undefined }}>
          <ul class="m-0 list-none p-0 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? loc.url.pathname === "/"
                  : loc.url.pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    class={[
                      "flex items-center rounded-lg text-sm font-medium no-underline transition-all duration-150",
                      isActive ? "nav-active" : "nav-inactive",
                      collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                    ].join(" ")}
                    style={{
                      background: isActive ? "var(--bg-active)" : "transparent",
                      color: isActive ? "var(--text-accent)" : "var(--text-secondary)",
                    }}
                    title={collapsed ? item.label : undefined}
                    onClick$={onClose$}
                  >
                    <IconMap name={item.icon} />
                    {!collapsed && item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div
          class="hidden lg:flex items-center border-t"
          style={{
            borderColor: "var(--border-default)",
            padding: collapsed ? "12px 8px" : "12px 16px",
            justifyContent: collapsed ? "center" : "flex-end",
          }}
        >
          <button
            type="button"
            class="btn btn-ghost btn-icon btn-sm"
            onClick$={onToggleCollapse$}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            style={{ color: "var(--text-tertiary)" }}
          >
            {collapsed ? (
              <LuChevronRight style={{ width: "18px", height: "18px" }} />
            ) : (
              <LuChevronLeft style={{ width: "18px", height: "18px" }} />
            )}
          </button>
        </div>

        {/* Footer — only when expanded */}
        {!collapsed && (
          <div
            class="px-5 py-4 text-xs lg:hidden"
            style={{
              color: "var(--text-tertiary)",
              borderTop: "1px solid var(--border-default)",
            }}
          >
            v1.0.0 • Indicadores de Saúde
          </div>
        )}
      </aside>
    </>
  );
});
