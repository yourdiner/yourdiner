import { getAvailableTables } from "./availability.service";

export async function suggestBestTable(
  restaurantId: string,
  windowStart: Date,
  windowEnd: Date,
  guestCount: number
) {
  const tables = await getAvailableTables(restaurantId, windowStart, windowEnd, guestCount);
  return tables[0] ?? null;
}
