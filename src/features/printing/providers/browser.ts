import type { PrinterProvider, PrintResult } from "../types";

export const browserPrintProvider: PrinterProvider = {
  id: "browser",
  async print({ html, escPosBase64 }): Promise<PrintResult> {
    return {
      ok: true,
      mode: "browser",
      html,
      escPosBase64,
    };
  },
};
