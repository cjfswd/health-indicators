/**
 * API Route: GET /api/reports/excel?period=month|quarter|year
 * Generates and streams an Excel workbook.
 */

import type { RequestHandler } from "@builder.io/qwik-city";
import { generateReportData } from "~/lib/report-engine";
import { generateExcelBuffer } from "~/lib/excel-report";

export const onGet: RequestHandler = async ({ query, send }) => {
  const period = query.get("period") || "month";

  try {
    const data = await generateReportData(period);
    const excelBuffer = await generateExcelBuffer(data);

    const filename = `Health Indicators-relatorio-${data.periodLabel.replace(/\s+/g, "-").toLowerCase()}.xlsx`;

    send(
      new Response(excelBuffer, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(excelBuffer.length),
        },
      })
    );
  } catch (error) {
    console.error("Excel generation error:", error);
    send(
      new Response(
        JSON.stringify({ error: "Failed to generate Excel report" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
  }
};
