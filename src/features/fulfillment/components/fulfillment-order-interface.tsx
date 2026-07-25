"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createFulfillmentOrderClient } from "@/lib/fulfillment-client";
import {
  OrderInterface,
  type OrderInterfaceCategory,
  type OrderInterfaceOrder,
} from "@/features/dining-session/components/order-interface";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrintReceiptButton } from "@/features/printing/components/print-receipt-button";

type Props = {
  orderId: string;
  orderType: "TAKEAWAY" | "DELIVERY";
  tableLabel: string;
  customerName?: string | null;
  orderStatus: string;
  paymentStatus: string;
  orderTotal: number;
  subtitle?: string;
  categories: OrderInterfaceCategory[];
  activeOrder: OrderInterfaceOrder | null;
};

const TYPE_LABEL = { TAKEAWAY: "Takeaway", DELIVERY: "Delivery" };

export function FulfillmentOrderInterface({
  orderId,
  orderType,
  tableLabel,
  customerName,
  orderStatus,
  paymentStatus,
  orderTotal,
  subtitle,
  categories,
  activeOrder,
}: Props) {
  const router = useRouter();
  const api = useMemo(() => createFulfillmentOrderClient(orderId), [orderId]);
  const [loading, setLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(String(orderTotal / 100));
  const [payMethod, setPayMethod] = useState<"CASH" | "CARD" | "UPI" | "OTHER">("CASH");

  async function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success?: string,
    onSuccess?: () => void
  ) {
    setLoading(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Action failed");
        return;
      }
      if (success) toast.success(success);
      if (onSuccess) onSuccess();
      else router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function openPaymentDialog() {
    setPayAmount(String(orderTotal / 100));
    setPayOpen(true);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
        <Badge variant="outline">{TYPE_LABEL[orderType]}</Badge>
        <Badge variant="secondary">{orderStatus.replace(/_/g, " ")}</Badge>
        <Badge
          variant={paymentStatus === "PAID" ? "default" : "outline"}
          className={paymentStatus === "PAID" ? "bg-primary" : undefined}
        >
          Payment: {paymentStatus}
        </Badge>
      </div>

      <OrderInterface
        tableLabel={tableLabel}
        guestCount={1}
        customerName={customerName}
        categories={categories}
        activeOrder={activeOrder}
        onBack={() => router.push("/admin/orders")}
        backLabel="All orders"
        subtitle={subtitle}
        actions={{
          addItem: (payload) =>
            run(() => api.addItem(payload)).then(() => undefined),
          updateItemConfig: (itemId, selection) =>
            run(() =>
              api.updateItemConfig({
                itemId,
                variantId: selection.variantId,
                modifierIds: selection.modifierIds,
                quantity: selection.quantity,
                notes: selection.notes,
                kitchenNotes: selection.kitchenNotes,
              })
            ).then(() => undefined),
          updateQty: (itemId, qty) =>
            run(() => api.updateQty(itemId, qty)).then(() => undefined),
          removeItem: (itemId) => run(() => api.removeItem(itemId)).then(() => undefined),
          submitKitchen: () =>
            run(() => api.submitKitchen(), "Sent to kitchen").then(() => undefined),
        }}
        footerExtra={
          <div className="space-y-2">
            {orderType === "TAKEAWAY" && (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  disabled={loading}
                  onClick={() => run(() => api.markReady(), "Ready for pickup")}
                >
                  Ready for Pickup
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  disabled={loading}
                  onClick={() => run(() => api.markPickedUp(), "Picked up")}
                >
                  Picked Up
                </Button>
              </>
            )}
            {orderType === "DELIVERY" && (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  disabled={loading}
                  onClick={() => run(() => api.markReady(), "Marked ready")}
                >
                  Mark Ready
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  disabled={loading}
                  onClick={() => run(() => api.markOutForDelivery())}
                >
                  Out for Delivery
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  disabled={loading}
                  onClick={() => run(() => api.markDelivered(), "Delivered")}
                >
                  Delivered
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              className="w-full"
              size="sm"
              disabled={loading}
              onClick={openPaymentDialog}
            >
              Record Payment
            </Button>
            <PrintReceiptButton
              orderId={orderId}
              kind="bill"
              triggerLabel="Print bill"
              className="w-full"
            />
            <PrintReceiptButton
              orderId={orderId}
              kind="kot"
              triggerLabel="Print KOT"
              className="w-full"
            />
            <Button
              className="w-full"
              size="sm"
              disabled={loading}
              onClick={() =>
                run(() => api.complete(), "Order completed", () =>
                  router.push("/admin/orders")
                )
              }
            >
              Complete Order
            </Button>
          </div>
        }
      />

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={(v) => setPayMethod(v as typeof payMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={loading}
              onClick={() =>
                run(
                  () =>
                    api.recordPayment(
                      Math.round(parseFloat(payAmount || "0") * 100),
                      payMethod
                    ),
                  "Payment recorded",
                  () => setPayOpen(false)
                )
              }
            >
              Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
