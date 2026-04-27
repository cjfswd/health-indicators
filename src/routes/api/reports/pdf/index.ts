/**
 * API Route: GET /api/reports/pdf?period=month|quarter|year
 * Generates and streams a PDF report.
 */

import type { RequestHandler } from "@builder.io/qwik-city";
import { generateReportData } from "~/lib/report-engine";
import { generatePdfBuffer } from "~/lib/pdf-report";

export const onGet: RequestHandler = async ({ query, send }) => {
  const period = query.get("period") || "month";

  try {
    const data = await generateReportData(period);
    const pdfBuffer = await generatePdfBuffer(data);

    const filename = `healthpanel-relatorio-${data.periodLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`;

    send(
      new Response(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(pdfBuffer.length),
        },
      })
    );
  } catch (error) {
    console.error("PDF generation error:", error);
    send(
      new Response(JSON.stringify({ error: "Failed to generate PDF report" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
  }
};
