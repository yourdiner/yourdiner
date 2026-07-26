import "server-only";

import { getRestaurantSettingsCached } from "@/lib/request-cache";
import { parsePrinterSettings } from "./settings";
import type { PrinterSettings } from "./types";

export async function getRestaurantPrinterSettings(
  restaurantId: string
): Promise<PrinterSettings> {
  const settings = await getRestaurantSettingsCached(restaurantId);
  return parsePrinterSettings(settings?.printerSettings);
}
