/**
 * This is the vite config for the Express production server build.
 */
import { extendConfig } from "@builder.io/qwik-city/vite";
import baseConfig from "../../vite.config";

export default extendConfig(baseConfig, () => {
  return {
    build: {
      ssr: true,
      rollupOptions: {
        input: ["src/entry.express.tsx", "@qwik-city-plan"],
        external: [
          "pdfmake",
          "pdfmake/js/Printer.js",
          "pdfmake/js/UrlResolver.js",
          "exceljs",
          "@electric-sql/pglite",
        ],
      },
    },
    ssr: {
      noExternal: true,
      external: [
        "pdfmake",
        "pdfmake/js/Printer.js",
        "pdfmake/js/UrlResolver.js",
        "exceljs",
        "@electric-sql/pglite",
      ],
    },
  };
});
