"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteRestaurantDialog } from "@/features/platform/components/delete-restaurant-dialog";
import { RestoreRestaurantDialog } from "@/features/platform/components/restore-restaurant-dialog";
import { PermanentDeleteDialog } from "@/features/platform/components/permanent-delete-dialog";
import { updateRestaurantStatus } from "@/features/restaurants/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Props = {
  restaurantId: string;
  restaurantName: string;
  status: string;
};

export function RestaurantLifecycleActions({
  restaurantId,
  restaurantName,
  status,
}: Props) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [permanentOpen, setPermanentOpen] = useState(false);

  async function handleSuspendToggle() {
    try {
      const next = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
      await updateRestaurantStatus({ restaurantId, status: next });
      toast.success(next === "ACTIVE" ? "Restaurant activated" : "Restaurant suspended");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Lifecycle Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {status === "ACTIVE" && (
            <>
              <Button variant="outline" onClick={handleSuspendToggle}>
                Suspend
              </Button>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete Restaurant
              </Button>
            </>
          )}
          {status === "SUSPENDED" && (
            <>
              <Button variant="outline" onClick={handleSuspendToggle}>
                Activate
              </Button>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete Restaurant
              </Button>
            </>
          )}
          {status === "DELETED" && (
            <>
              <Button onClick={() => setRestoreOpen(true)}>Restore Restaurant</Button>
              <Button variant="destructive" onClick={() => setPermanentOpen(true)}>
                Permanent Delete
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <DeleteRestaurantDialog
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
      <RestoreRestaurantDialog
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
      />
      <PermanentDeleteDialog
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        open={permanentOpen}
        onOpenChange={setPermanentOpen}
      />
    </>
  );
}
