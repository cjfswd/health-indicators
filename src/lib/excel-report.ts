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
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HealthPanel";
  workbook.created = new Date();

  // ═══════════════════════════════════════════════════
  // Sheet 1: Resumo
  // ═══════════════════════════════════════════════════
  const wsResumo = workbook.addWorksheet("Resumo", {
    properties: { tabColor: { argb: COLORS.primary } },
  });

  // Title
  wsResumo.mergeCells("A1:D1");
  const titleCell = wsResumo.getCell("A1");
  titleCell.value = `Relatório C-Level — ${data.periodLabel}`;
  titleCell.font = { bold: true, size: 16, color: { argb: COLORS.primary } };
  titleCell.alignment = { horizontal: "left" };

  wsResumo.mergeCells("A2:D2");
  const subtitleCell = wsResumo.getCell("A2");
  subtitleCell.value = `Período: ${data.periodStart} a ${data.periodEnd} | Gerado: ${data.generatedAt}`;
  subtitleCell.font = { size: 9, color: { argb: COLORS.muted } };

  // Stats
  wsResumo.getCell("A4").value = "Métrica";
  wsResumo.getCell("B4").value = "Valor";
  const statsHeader = wsResumo.getRow(4);
  applyHeaderStyle(statsHeader);

  const statsData = [
    ["Pacientes Ativos", data.stats.activePatientsCount],
    ["Total de Pacientes", data.stats.totalPatientsCount],
    ["Operadoras Ativas", data.stats.activeOperatorsCount],
    ["Eventos no Período", data.stats.currentEventsCount],
    ["Registros Auditados", data.stats.ledgerTotalCount],
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
  wsResumo.views = [{ state: "frozen", ySplit: 4 }];

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

    const row = wsInd.addRow({
      code: ind.code,
      name: ind.name,
      currentValue: ind.currentValue,
      target: ind.targetValue !== null
        ? `${ind.targetDirection === "lower_is_better" ? "≤" : "≥"} ${ind.targetValue}%`
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

  // ═══════════════════════════════════════════════════
  // Sheet 4: Auditoria
  // ═══════════════════════════════════════════════════
  const wsAudit = workbook.addWorksheet("Auditoria", {
    properties: { tabColor: { argb: COLORS.muted } },
  });

  wsAudit.columns = [
    { header: "Data/Hora", key: "timestamp", width: 22 },
    { header: "Operação", key: "operation", width: 14 },
    { header: "Tabela", key: "table", width: 18 },
    { header: "ID do Registro", key: "recordId", width: 38 },
    { header: "Executado por", key: "performedBy", width: 30 },
  ];

  applyHeaderStyle(wsAudit.getRow(1));

  data.ledgerEntries.forEach((l, i) => {
    const row = wsAudit.addRow({
      timestamp: l.timestamp,
      operation: l.operation,
      table: l.tableName,
      recordId: l.recordId,
      performedBy: l.performedBy,
    });
    applyAltRowStyle(row, i);

    // Color operation
    const opCell = row.getCell("operation");
    switch (l.operation) {
      case "CREATE": opCell.font = { bold: true, color: { argb: COLORS.success } }; break;
      case "UPDATE": opCell.font = { bold: true, color: { argb: COLORS.primary } }; break;
      case "DELETE": opCell.font = { bold: true, color: { argb: COLORS.danger } }; break;
      case "RESTORE": opCell.font = { bold: true, color: { argb: COLORS.warning } }; break;
    }
  });

  wsAudit.views = [{ state: "frozen", ySplit: 1 }];

  // ── Generate Buffer ───────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
