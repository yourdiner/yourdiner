import "server-only";

import { getRestaurantSettingsCached } from "@/lib/request-cache";
import { parseLoyaltySettings, type LoyaltySettings } from "@/lib/loyalty-settings";

export async function getRestaurantLoyaltySettings(
  restaurantId: string
): Promise<LoyaltySettings> {
  const settings = await getRestaurantSettingsCached(restaurantId);
  return parseLoyaltySettings(settings?.loyaltySettings);
}
