import type { PrinterProvider, PrintResult } from "../types";

/**
 * Sends ESC/POS bytes to a restaurant-local print agent.
 * Cloud servers cannot reach LAN printers directly.
 */
export const lanAgentPrintProvider: PrinterProvider = {
  id: "lan_agent",
  async print({ endpoint, escPosBase64, snapshot }): Promise<PrintResult> {
    const url = endpoint.printAgentUrl?.trim();
    if (!url) {
      return {
        ok: false,
        mode: "agent",
        errorMessage: "LAN print agent URL is not configured",
        escPosBase64,
      };
    }

    const copies = Math.max(1, endpoint.copies || 1);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escPosBase64,
          copies,
          cut: endpoint.autoCut,
          openDrawer: endpoint.cashDrawerTrigger && snapshot.kind === "bill",
          paperWidth: endpoint.paperWidth,
          printerIp: endpoint.ipAddress,
          printerPort: endpoint.port ?? 9100,
          jobKind: snapshot.kind,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          ok: false,
          mode: "agent",
          errorMessage: text || `Print agent returned ${res.status}`,
          escPosBase64,
          agentStatus: res.status === 503 ? "Paper Out" : "Error",
        };
      }

      return {
        ok: true,
        mode: "agent",
        escPosBase64,
        agentStatus: "Printing",
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? "Print agent timed out"
            : error.message
          : "Print agent unreachable";
      return {
        ok: false,
        mode: "agent",
        errorMessage: message,
        escPosBase64,
        agentStatus: "Offline",
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
