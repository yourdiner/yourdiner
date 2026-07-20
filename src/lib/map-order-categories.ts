import type { OrderInterfaceCategory } from "@/features/dining-session/components/order-interface";

type CategoryShell = {
  id: string;
  name: string;
  description?: string | null;
};

/** Map category shells for OrderInterface (products load progressively on the client). */
export function mapOrderCategories(categories: CategoryShell[]): OrderInterfaceCategory[] {
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    products: [],
  }));
}
