import type { PrinterConnectionType, PrinterProvider } from "../types";
import { browserPrintProvider } from "./browser";
import { lanAgentPrintProvider } from "./lan-agent";
import { bluetoothStubProvider, usbStubProvider } from "./stubs";

const registry: PrinterProvider[] = [
  browserPrintProvider,
  lanAgentPrintProvider,
  usbStubProvider,
  bluetoothStubProvider,
];

export function getProviderForConnection(type: PrinterConnectionType): PrinterProvider {
  switch (type) {
    case "LAN":
      return lanAgentPrintProvider;
    case "USB":
      return usbStubProvider;
    case "BLUETOOTH":
      return bluetoothStubProvider;
    case "BROWSER":
    default:
      return browserPrintProvider;
  }
}

export function listProviders(): PrinterProvider[] {
  return registry;
}
