"use client";

import { useTransition } from "react";
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
import { restoreRestaurant } from "@/features/restaurants/actions";
import { toast } from "sonner";

type Props = {
  restaurantId: string;
  restaurantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RestoreRestaurantDialog({
  restaurantId,
  restaurantName,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      try {
        await restoreRestaurant(restaurantId);
        toast.success("Restaurant restored");
        onOpenChange(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to restore restaurant");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore Restaurant</DialogTitle>
          <DialogDescription>
            Restore <strong>{restaurantName}</strong> to active status? Admin, staff, and customer
            access will be re-enabled. Subscription will not be automatically reactivated if it
            expired while deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleRestore} disabled={pending}>
            {pending ? "Restoring..." : "Restore Restaurant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
