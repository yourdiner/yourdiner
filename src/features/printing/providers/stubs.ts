import type { PrinterProvider, PrintResult } from "../types";

export const usbStubProvider: PrinterProvider = {
  id: "usb",
  async print(): Promise<PrintResult> {
    return {
      ok: false,
      mode: "stub",
      errorMessage: "USB printing is not available yet. Use Browser or LAN agent.",
    };
  },
};

export const bluetoothStubProvider: PrinterProvider = {
  id: "bluetooth",
  async print(): Promise<PrintResult> {
    return {
      ok: false,
      mode: "stub",
      errorMessage: "Bluetooth printing is not available yet. Use Browser or LAN agent.",
    };
  },
};
