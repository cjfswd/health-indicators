// Quick test to verify pdfmake loading
async function test() {
  try {
    console.log("1. Importing pdfmake...");
    const mod = await import("pdfmake/js/Printer.js");
    console.log("2. Module keys:", Object.keys(mod));
    const PdfPrinter = mod.default || mod;
    console.log("3. PdfPrinter type:", typeof PdfPrinter);

    const { resolve } = await import("node:path");
    const basePath = resolve(process.cwd(), "node_modules/pdfmake/build/fonts/Roboto");
    console.log("4. Font path:", basePath);

    const { existsSync } = await import("node:fs");
    console.log("5. Font exists:", existsSync(resolve(basePath, "Roboto-Regular.ttf")));

    const printer = new PdfPrinter({
      Roboto: {
        normal: resolve(basePath, "Roboto-Regular.ttf"),
        bold: resolve(basePath, "Roboto-Medium.ttf"),
        italics: resolve(basePath, "Roboto-Italic.ttf"),
        bolditalics: resolve(basePath, "Roboto-MediumItalic.ttf"),
      },
    });
    console.log("6. Printer created:", typeof printer);

    const doc = printer.createPdfKitDocument({
      content: [{ text: "Hello World" }],
      defaultStyle: { font: "Roboto" },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => {
      const buf = Buffer.concat(chunks);
      console.log("7. PDF generated OK - Size:", buf.length, "bytes");
    });
    doc.on("error", (err: Error) => {
      console.error("PDF error:", err.message);
    });
    doc.end();
  } catch (err) {
    console.error("ERROR:", err);
  }
}

test();
