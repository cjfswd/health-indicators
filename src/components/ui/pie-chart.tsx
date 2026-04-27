/**
 * PieChart — CSS conic-gradient pie chart for sub-indicator visualization
 */

import { component$ } from "@builder.io/qwik";

export interface PieChartSegment {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  segments: PieChartSegment[];
  size?: number;
  title?: string;
}

export const PieChart = component$<PieChartProps>(({ segments, size = 140, title }) => {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <div class="flex flex-col items-center gap-2">
        {title && (
          <span class="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            {title}
          </span>
        )}
        <div
          class="flex items-center justify-center rounded-full"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            background: "var(--bg-hover)",
          }}
        >
          <span class="text-xs" style={{ color: "var(--text-tertiary)" }}>Sem dados</span>
        </div>
      </div>
    );
  }

  // Build conic-gradient stops
  let accumulated = 0;
  const stops = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = accumulated;
      const pct = (s.value / total) * 100;
      accumulated += pct;
      return `${s.color} ${start}% ${accumulated}%`;
    })
    .join(", ");

  return (
    <div class="flex flex-col items-center gap-3">
      {title && (
        <span class="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {title}
        </span>
      )}

      <div
        class="rounded-full"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: `conic-gradient(${stops})`,
          boxShadow: "inset 0 0 0 0 var(--bg-card)",
          position: "relative",
        }}
      >
        {/* Inner circle for donut effect */}
        <div
          class="absolute rounded-full"
          style={{
            width: `${size * 0.55}px`,
            height: `${size * 0.55}px`,
            background: "var(--bg-card)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <div class="flex h-full flex-col items-center justify-center">
            <span class="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {total}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div class="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const pct = Math.round((s.value / total) * 100);
            return (
              <div key={s.label} class="flex items-center gap-1.5 text-xs">
                <span
                  class="inline-block rounded-sm"
                  style={{
                    width: "10px",
                    height: "10px",
                    background: s.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: "var(--text-secondary)" }}>
                  {s.label} ({pct}%)
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
});
