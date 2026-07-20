"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPermanentDeletePreview,
  permanentlyDeleteRestaurant,
} from "@/features/restaurants/actions";
import { toast } from "sonner";

type Props = {
  restaurantId: string;
  restaurantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Preview = {
  orders: number;
  customers: number;
  reservations: number;
  payments: number;
  invoices: number;
  staff: number;
  menuItems: number;
};

export function PermanentDeleteDialog({
  restaurantId,
  restaurantName,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmText, setConfirmText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmText("");
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    void getPermanentDeletePreview(restaurantId)
      .then(setPreview)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to load preview");
        onOpenChange(false);
      })
      .finally(() => setLoadingPreview(false));
  }, [open, restaurantId, onOpenChange]);

  function handlePermanentDelete() {
    startTransition(async () => {
      try {
        await permanentlyDeleteRestaurant(restaurantId);
        toast.success("Restaurant permanently deleted");
        onOpenChange(false);
        router.push("/platform/restaurants");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to permanently delete");
      }
    });
  }

  const canDelete = confirmText === "DELETE" && !pending && !loadingPreview;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Permanent Delete</DialogTitle>
          <DialogDescription>
            Permanently delete <strong>{restaurantName}</strong> and all operational data. Billing
            records will be archived for compliance.
          </DialogDescription>
        </DialogHeader>
        {loadingPreview ? (
          <p className="text-sm text-muted-foreground">Loading data summary...</p>
        ) : preview ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p>Orders: {preview.orders}</p>
            <p>Customers: {preview.customers}</p>
            <p>Reservations: {preview.reservations}</p>
            <p>Payments: {preview.payments}</p>
            <p>Invoices: {preview.invoices}</p>
            <p>Staff: {preview.staff}</p>
            <p>Menu items: {preview.menuItems}</p>
          </div>
        ) : null}
        <p className="text-sm font-medium text-destructive">
          This action cannot be undone. Type DELETE to confirm.
        </p>
        <div className="space-y-2">
          <Label htmlFor="confirm-delete">Confirmation</Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handlePermanentDelete} disabled={!canDelete}>
            {pending ? "Deleting..." : "Permanent Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
