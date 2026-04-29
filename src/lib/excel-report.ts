/**
 * Excel Report Generator — exceljs-based multi-sheet workbook
 */

import ExcelJS from "exceljs";
import type { ReportData } from "./report-engine";

// ── Colors ──────────────────────────────────────────
const COLORS = {
  primary: "2563EB",
  headerBg: "1E293B",
  headerText: "FFFFFF",
  success: "10B981",
  danger: "EF4444",
  warning: "F59E0B",
  muted: "6B7280",
  altRowBg: "F8FAFC",
  lightBg: "EFF6FF",
};

function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.headerBg },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "E2E8F0" } },
      bottom: { style: "thin", color: { argb: "E2E8F0" } },
    };
  });
  row.height = 24;
}

function applyAltRowStyle(row: ExcelJS.Row, index: number) {
  if (index % 2 === 0) {
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.altRowBg },
      };
    });
  }
}

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 50);
  });
}

export async function generateExcelBuffer(data: ReportData): Promise<Buffer> {
  const { resolve } = await import("node:path");
  const logoPath = resolve(process.cwd(), "public/images/logo.png");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Health Indicators";
  workbook.created = new Date();

  // ═══════════════════════════════════════════════════
  // Sheet 1: Resumo
  // ═══════════════════════════════════════════════════
  const wsResumo = workbook.addWorksheet("Resumo", {
    properties: { tabColor: { argb: COLORS.primary } },
  });

  // Logo (rows 1-3)
  const logoId = workbook.addImage({ filename: logoPath, extension: "png" });
  wsResumo.addImage(logoId, {
    tl: { col: 0, row: 0 },
    ext: { width: 200, height: 55 },
  });
  wsResumo.getRow(1).height = 20;
  wsResumo.getRow(2).height = 20;
  wsResumo.getRow(3).height = 20;

  // Title (row 4)
  wsResumo.mergeCells("A4:D4");
  const titleCell = wsResumo.getCell("A4");
  titleCell.value = `Relatório — ${data.periodLabel}`;
  titleCell.font = { bold: true, size: 16, color: { argb: COLORS.primary } };
  titleCell.alignment = { horizontal: "left" };

  wsResumo.mergeCells("A5:D5");
  const subtitleCell = wsResumo.getCell("A5");
  subtitleCell.value = `Período: ${data.periodStart} a ${data.periodEnd} | Gerado: ${data.generatedAt}`;
  subtitleCell.font = { size: 9, color: { argb: COLORS.muted } };

  // Stats
  wsResumo.getCell("A7").value = "Métrica";
  wsResumo.getCell("B7").value = "Valor";
  const statsHeader = wsResumo.getRow(7);
  applyHeaderStyle(statsHeader);

  const statsData = [
    ["Pacientes Ativos", data.stats.activePatientsCount],
    ["Total de Pacientes", data.stats.totalPatientsCount],
    ["Operadoras Ativas", data.stats.activeOperatorsCount],
    ["Eventos no Período", data.stats.currentEventsCount],
  ];

  statsData.forEach(([label, value], i) => {
    const row = wsResumo.addRow([label, value]);
    applyAltRowStyle(row, i);
  });

  // Modality section
  const modalityStartRow = wsResumo.rowCount + 2;
  wsResumo.getCell(`A${modalityStartRow}`).value = "Modalidade";
  wsResumo.getCell(`B${modalityStartRow}`).value = "Pacientes";
  wsResumo.getCell(`C${modalityStartRow}`).value = "Percentual";
  applyHeaderStyle(wsResumo.getRow(modalityStartRow));

  data.modalityBreakdown.forEach((m, i) => {
    const row = wsResumo.addRow([
      `${m.modality} — ${m.modality === "AD" ? "Atenção Domiciliar" : "Internação Domiciliar"}`,
      m.count,
      `${m.pct}%`,
    ]);
    applyAltRowStyle(row, i);
  });

  autoWidth(wsResumo);
  wsResumo.views = [{ state: "frozen", ySplit: 7 }];

  // ═══════════════════════════════════════════════════
  // Sheet 2: Indicadores
  // ═══════════════════════════════════════════════════
  const wsInd = workbook.addWorksheet("Indicadores", {
    properties: { tabColor: { argb: COLORS.success } },
  });

  wsInd.columns = [
    { header: "Código", key: "code", width: 10 },
    { header: "Indicador", key: "name", width: 45 },
    { header: "Valor Atual", key: "currentValue", width: 14 },
    { header: "Meta", key: "target", width: 14 },
    { header: "Direção", key: "direction", width: 18 },
    { header: "Periodicidade", key: "timeframe", width: 16 },
    { header: "Status", key: "status", width: 20 },
  ];

  applyHeaderStyle(wsInd.getRow(1));

  data.indicators.forEach((ind, i) => {
    const timeframeMap: Record<string, string> = {
      monthly: "Mensal",
      bimonthly: "Bimestral",
      quarterly: "Trimestral",
      quadrimestral: "Quadrimestral",
      semestral: "Semestral",
      annual: "Anual",
    };

    const statusMap: Record<string, string> = {
      within_target: "✓ Dentro da meta",
      outside_target: "✗ Fora da meta",
      no_data: "— Sem dados",
      informational: "Informacional",
    };

    const displayName = ind.isChild ? `    ${ind.name}` : ind.name;

    const row = wsInd.addRow({
      code: ind.code,
      name: displayName,
      currentValue: ind.currentValue,
      target: ind.targetValue !== null
        ? `${ind.targetDirection === "lower_is_better" ? "≤" : "≥"} ${ind.targetValue}${ind.targetFormat === "percentage" ? "%" : ""}`
        : "—",
      direction: ind.targetDirection === "higher_is_better"
        ? "Maior é melhor"
        : ind.targetDirection === "lower_is_better"
          ? "Menor é melhor"
          : "—",
      timeframe: timeframeMap[ind.targetTimeframe || ""] || "—",
      status: statusMap[ind.status] || ind.status,
    });

    applyAltRowStyle(row, i);

    // Style parent rows bold, child rows lighter
    if (!ind.isChild) {
      row.getCell("code").font = { bold: true, size: 10 };
      row.getCell("name").font = { bold: true, size: 10 };
    } else {
      row.getCell("code").font = { size: 9, color: { argb: COLORS.muted } };
      row.getCell("name").font = { size: 9, color: { argb: COLORS.muted } };
    }

    // Color the status cell
    const statusCell = row.getCell("status");
    if (ind.status === "within_target") {
      statusCell.font = { bold: true, color: { argb: COLORS.success } };
    } else if (ind.status === "outside_target") {
      statusCell.font = { bold: true, color: { argb: COLORS.danger } };
    } else {
      statusCell.font = { color: { argb: COLORS.muted } };
    }
  });

  wsInd.views = [{ state: "frozen", ySplit: 1 }];

  // ═══════════════════════════════════════════════════
  // Sheet 3: Eventos
  // ═══════════════════════════════════════════════════
  const wsEvents = workbook.addWorksheet("Eventos", {
    properties: { tabColor: { argb: COLORS.warning } },
  });

  wsEvents.columns = [
    { header: "Data", key: "date", width: 14 },
    { header: "Paciente", key: "patient", width: 25 },
    { header: "Operadora", key: "operator", width: 20 },
    { header: "Categoria", key: "category", width: 25 },
    { header: "Subcategoria", key: "subCategory", width: 25 },
    { header: "Descrição", key: "description", width: 40 },
  ];

  applyHeaderStyle(wsEvents.getRow(1));

  data.eventDetails.forEach((e, i) => {
    const row = wsEvents.addRow({
      date: e.occurredAt,
      patient: e.patientName,
      operator: e.operatorName,
      category: e.category,
      subCategory: e.subCategory || "—",
      description: e.description || "—",
    });
    applyAltRowStyle(row, i);
  });

  wsEvents.views = [{ state: "frozen", ySplit: 1 }];

  // ── Generate Buffer ───────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
