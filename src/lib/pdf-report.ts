/**
 * PDF Report Generator — pdfmake-based report
 */

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import type { ReportData } from "./report-engine";

// ── Colors ──────────────────────────────────────────
const COLORS = {
  primary: "#2563eb",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  muted: "#6b7280",
  headerBg: "#1e293b",
  headerText: "#ffffff",
  altRowBg: "#f8fafc",
  border: "#e2e8f0",
};

function statusLabel(status: string) {
  switch (status) {
    case "within_target": return "✓ Dentro da meta";
    case "outside_target": return "✗ Fora da meta";
    case "no_data": return "— Sem dados";
    default: return "Informacional";
  }
}

function statusColor(status: string) {
  switch (status) {
    case "within_target": return COLORS.success;
    case "outside_target": return COLORS.danger;
    default: return COLORS.muted;
  }
}

export async function generatePdfBuffer(data: ReportData): Promise<Buffer> {
  // Dynamic imports for pdfmake v0.3 server-side usage
  const pdfMakeModule = await import("pdfmake/js/Printer.js" as any);
  const urlResolverModule = await import("pdfmake/js/UrlResolver.js" as any);
  const pdfmakeMain = await import("pdfmake" as any);

  // Handle CJS→ESM interop double-wrapping
  const PdfPrinter = pdfMakeModule.default?.default || pdfMakeModule.default;
  const UrlResolver = urlResolverModule.default?.default || urlResolverModule.default;
  const virtualfs = pdfmakeMain.default?.virtualfs || pdfmakeMain.virtualfs;

  // Resolve font paths relative to node_modules
  const { resolve } = await import("node:path");
  const basePath = resolve(process.cwd(), "node_modules/pdfmake/build/fonts/Roboto");

  const urlResolver = new UrlResolver();
  const printer = new PdfPrinter(
    {
      Roboto: {
        normal: resolve(basePath, "Roboto-Regular.ttf"),
        bold: resolve(basePath, "Roboto-Medium.ttf"),
        italics: resolve(basePath, "Roboto-Italic.ttf"),
        bolditalics: resolve(basePath, "Roboto-MediumItalic.ttf"),
      },
    },
    virtualfs,
    urlResolver
  );

  // Read logo and watermark images as base64
  const { readFileSync } = await import("node:fs");
  const logoPath = resolve(process.cwd(), "public/images/logo.png");
  const watermarkPath = resolve(process.cwd(), "public/images/watermark.png");
  const logoBase64 = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;
  const watermarkBase64 = `data:image/png;base64,${readFileSync(watermarkPath).toString("base64")}`;

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 80, 40, 60],

    // Watermark on every page
    background: () => ({
      image: watermarkBase64,
      width: 300,
      absolutePosition: { x: 150, y: 250 },
    }),

    header: {
      columns: [
        {
          image: logoBase64,
          width: 120,
          margin: [40, 15, 0, 0] as [number, number, number, number],
        },
        {
          text: `Relatório de Indicadores — ${data.periodLabel}`,
          style: "headerSubtitle",
          alignment: "right" as const,
          margin: [0, 30, 40, 0] as [number, number, number, number],
        },
      ],
    },

    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: `Gerado em: ${data.generatedAt}`,
          style: "footerText",
          margin: [40, 0, 0, 0],
        },
        {
          text: `Página ${currentPage} de ${pageCount}`,
          style: "footerText",
          alignment: "right",
          margin: [0, 0, 40, 0],
        },
      ],
    }),

    content: [
      // ── Title ──────────────────────────────────
      {
        text: `Relatório — ${data.periodLabel}`,
        style: "title",
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      {
        text: `Período: ${data.periodStart} a ${data.periodEnd}`,
        style: "subtitle",
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },

      // ── Stats Summary ─────────────────────────
      {
        text: "Resumo Geral",
        style: "sectionHeader",
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },
      {
        table: {
          widths: ["*", "*", "*"],
          body: [
            [
              { text: "Pacientes Ativos", style: "statLabel" },
              { text: "Operadoras", style: "statLabel" },
              { text: "Eventos no Período", style: "statLabel" },
            ],
            [
              { text: String(data.stats.activePatientsCount), style: "statValue" },
              { text: String(data.stats.activeOperatorsCount), style: "statValue" },
              { text: String(data.stats.currentEventsCount), style: "statValue" },
            ],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex === 0 ? COLORS.headerBg : null,
          hLineColor: () => COLORS.border,
          vLineColor: () => COLORS.border,
          paddingTop: () => 8,
          paddingBottom: () => 8,
          paddingLeft: () => 10,
          paddingRight: () => 10,
        },
        margin: [0, 0, 0, 20] as [number, number, number, number],
      } as Content,

      // ── Modality ──────────────────────────────
      {
        text: "Modalidade de Atendimento",
        style: "sectionHeader",
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },
      {
        table: {
          widths: ["*", "auto", "auto"],
          body: [
            [
              { text: "Modalidade", style: "tableHeader" },
              { text: "Pacientes", style: "tableHeader" },
              { text: "Percentual", style: "tableHeader" },
            ],
            ...data.modalityBreakdown.map((m, i) => [
              { text: `${m.modality} — ${m.modality === "AD" ? "Atenção Domiciliar" : "Internação Domiciliar"}`, fillColor: i % 2 ? COLORS.altRowBg : null },
              { text: String(m.count), alignment: "center" as const, fillColor: i % 2 ? COLORS.altRowBg : null },
              { text: `${m.pct}%`, alignment: "center" as const, fillColor: i % 2 ? COLORS.altRowBg : null },
            ]),
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex === 0 ? COLORS.headerBg : null,
          fillOpacity: (rowIndex: number) => rowIndex === 0 ? 1 : 0.5,
          hLineColor: () => COLORS.border,
          vLineColor: () => COLORS.border,
          paddingTop: () => 6,
          paddingBottom: () => 6,
          paddingLeft: () => 10,
          paddingRight: () => 10,
        },
        margin: [0, 0, 0, 20] as [number, number, number, number],
      } as Content,

      // ── Indicators ────────────────────────────
      {
        text: "Indicadores de Desempenho",
        style: "sectionHeader",
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },
      {
        table: {
          widths: [30, "*", "auto", "auto", "auto"],
          body: [
            [
              { text: "Cód.", style: "tableHeader" },
              { text: "Indicador", style: "tableHeader" },
              { text: "Valor", style: "tableHeader" },
              { text: "Meta", style: "tableHeader" },
              { text: "Status", style: "tableHeader" },
            ],
            ...data.indicators.map((ind, i) => [
              { text: ind.code, bold: !ind.isChild, color: ind.isChild ? COLORS.muted : undefined, fillColor: i % 2 ? COLORS.altRowBg : null },
              { text: ind.isChild ? `  ${ind.name}` : ind.name, color: ind.isChild ? COLORS.muted : undefined, fillColor: i % 2 ? COLORS.altRowBg : null },
              { text: String(ind.currentValue), alignment: "center" as const, fillColor: i % 2 ? COLORS.altRowBg : null },
              {
                text: ind.targetValue !== null
                  ? `${ind.targetDirection === "lower_is_better" ? "≤" : "≥"} ${ind.targetValue}${ind.targetFormat === "percentage" ? "%" : ""}`
                  : "—",
                alignment: "center" as const,
                fillColor: i % 2 ? COLORS.altRowBg : null,
              },
              {
                text: statusLabel(ind.status),
                color: statusColor(ind.status),
                bold: true,
                fillColor: i % 2 ? COLORS.altRowBg : null,
              },
            ]),
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex === 0 ? COLORS.headerBg : null,
          fillOpacity: (rowIndex: number) => rowIndex === 0 ? 1 : 0.5,
          hLineColor: () => COLORS.border,
          vLineColor: () => COLORS.border,
          paddingTop: () => 6,
          paddingBottom: () => 6,
          paddingLeft: () => 8,
          paddingRight: () => 8,
        },
        margin: [0, 0, 0, 20] as [number, number, number, number],
      } as Content,

      // ── Category Breakdown ────────────────────
      ...(data.categoryBreakdown.length > 0
        ? [
            {
              text: "Eventos por Categoria",
              style: "sectionHeader",
              margin: [0, 0, 0, 8] as [number, number, number, number],
            },
            {
              table: {
                widths: ["*", "auto", "auto"],
                body: [
                  [
                    { text: "Categoria", style: "tableHeader" },
                    { text: "Quantidade", style: "tableHeader" },
                    { text: "Percentual", style: "tableHeader" },
                  ],
                  ...data.categoryBreakdown.map((c, i) => [
                    { text: c.label, fillColor: i % 2 ? COLORS.altRowBg : null },
                    { text: String(c.count), alignment: "center" as const, fillColor: i % 2 ? COLORS.altRowBg : null },
                    { text: `${c.pct}%`, alignment: "center" as const, fillColor: i % 2 ? COLORS.altRowBg : null },
                  ]),
                ],
              },
              layout: {
                fillColor: (rowIndex: number) => rowIndex === 0 ? COLORS.headerBg : null,
                fillOpacity: (rowIndex: number) => rowIndex === 0 ? 1 : 0.5,
                hLineColor: () => COLORS.border,
                vLineColor: () => COLORS.border,
                paddingTop: () => 6,
                paddingBottom: () => 6,
                paddingLeft: () => 10,
                paddingRight: () => 10,
              },
              margin: [0, 0, 0, 20] as [number, number, number, number],
            } as Content,
          ]
        : []),

      // ── Event Details ─────────────────────────
      ...(data.eventDetails.length > 0
        ? [
            {
              text: "Detalhamento de Eventos",
              style: "sectionHeader",
              margin: [0, 0, 0, 8] as [number, number, number, number],
              pageBreak: "before" as const,
            },
            {
              table: {
                widths: ["auto", "auto", "auto", "auto", "*"],
                body: [
                  [
                    { text: "Data", style: "tableHeader" },
                    { text: "Paciente", style: "tableHeader" },
                    { text: "Operadora", style: "tableHeader" },
                    { text: "Categoria", style: "tableHeader" },
                    { text: "Descrição", style: "tableHeader" },
                  ],
                  ...data.eventDetails.map((e, i) => [
                    { text: e.occurredAt, fontSize: 8, fillColor: i % 2 ? COLORS.altRowBg : null },
                    { text: e.patientName, fontSize: 8, fillColor: i % 2 ? COLORS.altRowBg : null },
                    { text: e.operatorName, fontSize: 8, fillColor: i % 2 ? COLORS.altRowBg : null },
                    { text: e.category, fontSize: 8, fillColor: i % 2 ? COLORS.altRowBg : null },
                    { text: e.description || "—", fontSize: 8, fillColor: i % 2 ? COLORS.altRowBg : null },
                  ]),
                ],
              },
              layout: {
                fillColor: (rowIndex: number) => rowIndex === 0 ? COLORS.headerBg : null,
                fillOpacity: (rowIndex: number) => rowIndex === 0 ? 1 : 0.5,
                hLineColor: () => COLORS.border,
                vLineColor: () => COLORS.border,
                paddingTop: () => 4,
                paddingBottom: () => 4,
                paddingLeft: () => 6,
                paddingRight: () => 6,
              },
            } as Content,
          ]
        : []),
    ],

    styles: {
      title: { fontSize: 20, bold: true, color: COLORS.headerBg },
      subtitle: { fontSize: 10, color: COLORS.muted },
      sectionHeader: {
        fontSize: 13,
        bold: true,
        color: COLORS.primary,
      },
      tableHeader: {
        fontSize: 9,
        bold: true,
        color: COLORS.headerText,
      },
      statLabel: {
        fontSize: 8,
        bold: true,
        color: COLORS.headerText,
        alignment: "center" as const,
      },
      statValue: {
        fontSize: 18,
        bold: true,
        color: COLORS.primary,
        alignment: "center" as const,
      },
      headerBrand: { fontSize: 12, bold: true, color: COLORS.primary },
      headerSubtitle: { fontSize: 9, color: COLORS.muted },
      footerText: { fontSize: 8, color: COLORS.muted },
    },

    defaultStyle: { fontSize: 9, font: "Roboto" },
  };

  // createPdfKitDocument is async in pdfmake v0.3
  const pdfDoc = await printer.createPdfKitDocument(docDefinition);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", (err: Error) => reject(err));
    pdfDoc.end();
  });
}
