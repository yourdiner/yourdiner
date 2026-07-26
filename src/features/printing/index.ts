export type {
  PrinterSettings,
  PrinterEndpointConfig,
  PrintSnapshot,
  BillSnapshot,
  KotSnapshot,
  PrintResult,
} from "./types";

export {
  parsePrinterSettings,
  DEFAULT_PRINTER_SETTINGS,
} from "./settings";

export { renderSnapshotHtml } from "./render/html-receipt";
export { renderSnapshotEscPos } from "./render/escpos-receipt";
export {
  buildThermalReceiptCss,
  parsePaperWidthFromHtml,
} from "./render/thermal-receipt-css";

/** Server-only: use `@/features/printing/settings` or dynamic import for getRestaurantPrinterSettings. */
