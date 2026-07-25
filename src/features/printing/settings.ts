import type {
  PaperWidth,
  PrinterConnectionType,
  PrinterEndpointConfig,
  PrinterSettings,
} from "./types";

const DEFAULT_ENDPOINT = (role: "Billing" | "Kitchen"): PrinterEndpointConfig => ({
  enabled: true,
  name: `${role} Printer`,
  connectionType: "BROWSER",
  port: 9100,
  paperWidth: "80",
  printLogo: true,
  autoCut: true,
  cashDrawerTrigger: false,
  copies: 1,
});

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  billingPrinter: DEFAULT_ENDPOINT("Billing"),
  kitchenPrinter: DEFAULT_ENDPOINT("Kitchen"),
  autoPrintKitchenTickets: false,
  autoPrintCustomerBills: false,
};

function parseConnectionType(raw: unknown): PrinterConnectionType {
  if (raw === "LAN" || raw === "USB" || raw === "BLUETOOTH" || raw === "BROWSER") {
    return raw;
  }
  return "BROWSER";
}

function parsePaperWidth(raw: unknown): PaperWidth {
  return raw === "58" ? "58" : "80";
}

function parseEndpoint(raw: unknown, fallback: PrinterEndpointConfig): PrinterEndpointConfig {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const o = raw as Record<string, unknown>;
  const copies = typeof o.copies === "number" ? Math.min(5, Math.max(1, Math.round(o.copies))) : 1;
  const port =
    typeof o.port === "number" && o.port > 0 && o.port < 65536 ? Math.round(o.port) : 9100;

  return {
    enabled: o.enabled !== false,
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : fallback.name,
    connectionType: parseConnectionType(o.connectionType),
    ipAddress: typeof o.ipAddress === "string" ? o.ipAddress.trim() : undefined,
    port,
    printAgentUrl: typeof o.printAgentUrl === "string" ? o.printAgentUrl.trim() : undefined,
    paperWidth: parsePaperWidth(o.paperWidth),
    printLogo: o.printLogo !== false,
    header: typeof o.header === "string" ? o.header : undefined,
    footerMessage: typeof o.footerMessage === "string" ? o.footerMessage : undefined,
    autoCut: o.autoCut !== false,
    cashDrawerTrigger: o.cashDrawerTrigger === true,
    copies,
  };
}

export function parsePrinterSettings(raw: unknown): PrinterSettings {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_PRINTER_SETTINGS);
  const o = raw as Record<string, unknown>;
  return {
    billingPrinter: parseEndpoint(o.billingPrinter, DEFAULT_PRINTER_SETTINGS.billingPrinter),
    kitchenPrinter: parseEndpoint(o.kitchenPrinter, DEFAULT_PRINTER_SETTINGS.kitchenPrinter),
    autoPrintKitchenTickets: o.autoPrintKitchenTickets === true,
    autoPrintCustomerBills: o.autoPrintCustomerBills === true,
    printers: Array.isArray(o.printers)
      ? o.printers.map((p, i) =>
          parseEndpoint(p, {
            ...DEFAULT_PRINTER_SETTINGS.billingPrinter,
            name: `Printer ${i + 1}`,
          })
        )
      : undefined,
  };
}

export async function getRestaurantPrinterSettings(
  restaurantId: string
): Promise<PrinterSettings> {
  const { getRestaurantSettingsCached } = await import("@/lib/request-cache");
  const settings = await getRestaurantSettingsCached(restaurantId);
  return parsePrinterSettings(settings?.printerSettings);
}
