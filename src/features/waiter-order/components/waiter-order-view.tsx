"use client";

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createStaffOrderClient } from "@/lib/order-client";
import type { OrderMutationResult } from "@/lib/order-mutations";
import {
  PublicMenuView,
  type MenuData,
  type MenuActiveOrder,
  type StaffMenuActions,
  type StaffShellInfo,
} from "@/features/menu/components/public-menu-view";

type Props = {
  menu: MenuData;
  sessionId: string;
  tableLabel: string;
  guestCount: number;
  customerName?: string | null;
  activeOrder: MenuActiveOrder | null;
  staffShell: StaffShellInfo;
};

export function WaiterOrderView({
  menu,
  sessionId,
  tableLabel,
  guestCount,
  customerName,
  activeOrder,
  staffShell,
}: Props) {
  const router = useRouter();
  const orderApi = useMemo(() => createStaffOrderClient(sessionId), [sessionId]);

  const runMutation = useCallback(
    async (
      action: () => Promise<OrderMutationResult>,
      options?: { redirect?: string; successMessage?: string }
    ) => {
      const result = await action();
      if (!result.ok) {
        if (result.error === "STAFF_UNAUTHORIZED") {
          window.location.href = "/staff/login";
          return;
        }
        toast.error(result.error);
        throw new Error(result.error);
      }
      if (options?.redirect) {
        router.push(options.redirect);
      } else {
        router.refresh();
      }
      if (options?.successMessage) {
        toast.success(options.successMessage);
      }
    },
    [router]
  );

  const staffActions: StaffMenuActions = useMemo(
    () => ({
      addItem: (productId, quantity = 1, options) =>
        runMutation(() =>
          orderApi.addItem({
            productId,
            quantity,
            variantId: options?.variantId ?? undefined,
            modifierIds: options?.modifierIds,
            notes: options?.notes,
            kitchenNotes: options?.kitchenNotes,
          })
        ),
      updateItemConfig: (itemId, selection) =>
        runMutation(() =>
          orderApi.updateItemConfig({
            itemId,
            variantId: selection.variantId,
            modifierIds: selection.modifierIds,
            quantity: selection.quantity,
            notes: selection.notes,
            kitchenNotes: selection.kitchenNotes,
          })
        ),
      updateQty: (itemId, quantity) =>
        runMutation(() => orderApi.updateQty(itemId, quantity)),
      removeItem: (itemId) => runMutation(() => orderApi.removeItem(itemId)),
      submitKitchen: () =>
        runMutation(() => orderApi.submitKitchen(), { successMessage: "Sent to kitchen" }),
      requestBill: () => runMutation(() => orderApi.requestBill()),
      closeSession: async () => {
        /* waiters cannot close sessions from the order screen */
      },
    }),
    [orderApi, runMutation]
  );

  return (
    <PublicMenuView
      menu={menu}
      tableLabel={tableLabel}
      mode="staff"
      guestCount={guestCount}
      customerName={customerName ?? undefined}
      activeOrder={activeOrder}
      staffActions={staffActions}
      staffShell={staffShell}
    />
  );
}
