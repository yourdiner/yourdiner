"use client";

import { useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { deleteRestaurant } from "@/features/restaurants/actions";
import { toast } from "sonner";

type Props = {
  restaurantId: string;
  restaurantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteRestaurantDialog({
  restaurantId,
  restaurantName,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteRestaurant(restaurantId, reason.trim() || undefined);
        toast.success("Restaurant deleted");
        onOpenChange(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete restaurant");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Restaurant</DialogTitle>
          <DialogDescription>
            You are about to delete <strong>{restaurantName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>This action will:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Disable the restaurant dashboard</li>
            <li>Disable all staff logins</li>
            <li>Disable customer QR ordering</li>
            <li>Disable reservations</li>
            <li>Disable API access</li>
            <li>Disable the restaurant subdomain</li>
            <li>Cancel future subscription renewals</li>
            <li>Preserve all historical data</li>
          </ul>
        </div>
        <div className="space-y-2">
          <Label htmlFor="delete-reason">Reason (optional)</Label>
          <Textarea
            id="delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this restaurant being deleted?"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting..." : "Delete Restaurant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
