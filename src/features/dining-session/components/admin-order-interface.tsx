"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAdminOrderClient } from "@/lib/order-client";
import type { OrderMutationResult } from "@/lib/order-mutations";
import { Button } from "@/components/ui/button";
import { Receipt, XCircle } from "lucide-react";
import {
  OrderInterface,
  type OrderInterfaceCategory,
  type OrderInterfaceOrder,
} from "@/features/dining-session/components/order-interface";

type Props = {
  sessionId: string;
  tableLabel: string;
  guestCount: number;
  customerName?: string | null;
  categories: OrderInterfaceCategory[];
  activeOrder: OrderInterfaceOrder | null;
};

async function runAction(
  router: ReturnType<typeof useRouter>,
  action: () => Promise<OrderMutationResult>,
  onSuccess?: () => void
) {
  const result = await action();
  if (!result.ok) {
    toast.error(result.error);
    return;
  }
  if (onSuccess) onSuccess();
  else router.refresh();
}

export function AdminOrderInterface(props: Props) {
  const router = useRouter();
  const { sessionId } = props;
  const orderApi = useMemo(() => createAdminOrderClient(sessionId), [sessionId]);

  return (
    <OrderInterface
      {...props}
      allowSentItemEdits
      onBack={() => router.push(`/admin/orders/${sessionId}`)}
      backLabel="Session detail"
      actions={{
        addItem: (payload) => runAction(router, () => orderApi.addItem(payload)),
        updateItemConfig: (itemId, selection) =>
          runAction(router, () =>
            orderApi.updateItemConfig({
              itemId,
              variantId: selection.variantId,
              modifierIds: selection.modifierIds,
              quantity: selection.quantity,
              notes: selection.notes,
              kitchenNotes: selection.kitchenNotes,
            })
          ),
        updateQty: (itemId, qty) => runAction(router, () => orderApi.updateQty(itemId, qty)),
        removeItem: (itemId) => runAction(router, () => orderApi.removeItem(itemId)),
        submitKitchen: () => runAction(router, () => orderApi.submitKitchen()),
      }}
      footerExtra={
        <>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => runAction(router, () => orderApi.requestBill())}
          >
            <Receipt className="mr-2 h-4 w-4" />
            Request Bill
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => runAction(router, () => orderApi.closeSession(), () => router.push("/admin/orders"))}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Close Session
          </Button>
        </>
      }
    />
  );
}
