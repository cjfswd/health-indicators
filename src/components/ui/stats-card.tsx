import { component$ } from "@builder.io/qwik";
import {
  LuTrendingUp,
  LuTrendingDown,
  LuMinus,
  LuUsers,
  LuBuilding2,
  LuCalendarClock,
  LuShieldCheck,
  LuActivity,
  LuHeart,
  LuAlertTriangle,
  LuMessageSquare,
  LuSkull,
  LuFileText,
  LuUserCheck,
  LuBug,
} from "@qwikest/icons/lucide";

interface StatsCardProps {
  label: string;
  value: string | number;
  /** String icon identifier instead of JSX to avoid Qwik serialization issues */
  iconName?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  subtitle?: string;
}

/** Renders an icon by name — avoids passing non-serializable JSX through props */
const IconByName = component$<{ name: string }>(({ name }) => {
  const style = { width: "22px", height: "22px" };
  switch (name) {
    case "users": return <LuUsers style={style} />;
    case "building": return <LuBuilding2 style={style} />;
    case "calendar": return <LuCalendarClock style={style} />;
    case "shield": return <LuShieldCheck style={style} />;
    case "trending-up": return <LuTrendingUp style={style} />;
    case "activity": return <LuActivity style={style} />;
    case "heart": return <LuHeart style={style} />;
    case "alert": return <LuAlertTriangle style={style} />;
    case "message": return <LuMessageSquare style={style} />;
    case "skull": return <LuSkull style={style} />;
    case "file": return <LuFileText style={style} />;
    case "user-check": return <LuUserCheck style={style} />;
    case "bug": return <LuBug style={style} />;
    default: return <LuActivity style={style} />;
  }
});

export const StatsCard = component$<StatsCardProps>(
  ({ label, value, iconName, trend, trendValue, subtitle }) => {
    return (
      <div class="card px-5 py-4 animate-slide-up">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <p
              class="m-0 text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {label}
            </p>
            <p
              class="m-0 mt-2 text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {value}
            </p>
            {(trend || subtitle) && (
              <div class="mt-2 flex items-center gap-2">
                {trend && (
                  <span
                    class="flex items-center gap-1 text-xs font-medium"
                    style={{
                      color:
                        trend === "up"
                          ? "var(--color-success)"
                          : trend === "down"
                            ? "var(--color-danger)"
                            : "var(--text-tertiary)",
                    }}
                  >
                    {trend === "up" && (
                      <LuTrendingUp style={{ width: "14px", height: "14px" }} />
                    )}
                    {trend === "down" && (
                      <LuTrendingDown style={{ width: "14px", height: "14px" }} />
                    )}
                    {trend === "neutral" && (
                      <LuMinus style={{ width: "14px", height: "14px" }} />
                    )}
                    {trendValue}
                  </span>
                )}
                {subtitle && (
                  <span
                    class="text-xs"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {subtitle}
                  </span>
                )}
              </div>
            )}
          </div>

          {iconName && (
            <div
              class="flex items-center justify-center rounded-xl"
              style={{
                width: "44px",
                height: "44px",
                background: "var(--bg-active)",
                color: "var(--text-accent)",
              }}
            >
              <IconByName name={iconName} />
            </div>
          )}
        </div>
      </div>
    );
  }
);
