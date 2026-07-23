"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRestaurantStatus } from "@/features/restaurants/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pause, Play, Trash2, RotateCcw, Skull } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { DeleteRestaurantDialog } from "@/features/platform/components/delete-restaurant-dialog";
import { RestoreRestaurantDialog } from "@/features/platform/components/restore-restaurant-dialog";
import { PermanentDeleteDialog } from "@/features/platform/components/permanent-delete-dialog";

interface RestaurantRowProps {
  restaurant: {
    id: string;
    name: string;
    subdomain: string;
    uuid: string;
    status: string;
    ownerTempPassword?: string | null;
    deletedAt?: Date | string | null;
    deleteReason?: string | null;
    deletedByUser?: { name: string; email: string } | null;
    subscription?: {
      status: string;
      plan: { name: string };
    } | null;
    _count: { products: number; categories: number };
    staff: Array<{ user: { email: string; name: string } | null; displayName: string }>;
  };
  showDeletedMeta?: boolean;
}

export function RestaurantRow({ restaurant, showDeletedMeta = false }: RestaurantRowProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [permanentOpen, setPermanentOpen] = useState(false);

  const handleRowClick = () => {
    router.push(`/platform/restaurants/${restaurant.id}`);
  };

  const stopRowClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleStatus = async (status: "ACTIVE" | "SUSPENDED") => {
    try {
      await updateRestaurantStatus({ restaurantId: restaurant.id, status });
      toast.success(`Restaurant ${status === "ACTIVE" ? "activated" : "suspended"}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  };

  const statusVariant =
    restaurant.status === "ACTIVE"
      ? "success"
      : restaurant.status === "SUSPENDED"
        ? "destructive"
        : restaurant.status === "DELETED"
          ? "secondary"
          : "secondary";

  return (
    <>
      <tr
        className="cursor-pointer border-b hover:bg-muted/50"
        onClick={handleRowClick}
      >
        <td className="px-4 py-3">
          <div>
            <p className="font-medium">{restaurant.name}</p>
            <p className="text-xs text-muted-foreground">{restaurant.subdomain}</p>
            {showDeletedMeta && restaurant.deletedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Deleted {formatDateTime(restaurant.deletedAt)}
                {restaurant.deletedByUser
                  ? ` by ${restaurant.deletedByUser.name || restaurant.deletedByUser.email}`
                  : ""}
              </p>
            )}
            {showDeletedMeta && restaurant.deleteReason && (
              <p className="text-xs text-muted-foreground">Reason: {restaurant.deleteReason}</p>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge variant={statusVariant as "default"}>{restaurant.status}</Badge>
        </td>
        <td className="px-4 py-3 text-sm">
          {restaurant.subscription?.plan.name || "—"}
          <br />
          <span className="text-xs text-muted-foreground">
            {restaurant.subscription?.status || "—"}
          </span>
        </td>
        <td className="px-4 py-3 text-sm">
          {restaurant._count.categories} cat / {restaurant._count.products} prod
        </td>
        <td className="px-4 py-3 text-sm">
          <div>{restaurant.staff[0]?.user?.email || restaurant.staff[0]?.displayName || "—"}</div>
          {restaurant.ownerTempPassword && (
            <div className="mt-1">
              <span className="text-xs text-muted-foreground">Temp password: </span>
              <span className="font-mono text-xs font-medium">{restaurant.ownerTempPassword}</span>
            </div>
          )}
        </td>
        <td className="px-4 py-3" onClick={stopRowClick}>
          <div className="flex items-center gap-1">
            {restaurant.status === "ACTIVE" && (
              <Button variant="ghost" size="icon" onClick={() => handleStatus("SUSPENDED")}>
                <Pause className="h-4 w-4" />
              </Button>
            )}
            {restaurant.status === "SUSPENDED" && (
              <Button variant="ghost" size="icon" onClick={() => handleStatus("ACTIVE")}>
                <Play className="h-4 w-4" />
              </Button>
            )}
            {restaurant.status !== "DELETED" && (
              <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
            {restaurant.status === "DELETED" && (
              <>
                <Button variant="ghost" size="icon" onClick={() => setRestoreOpen(true)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPermanentOpen(true)}>
                  <Skull className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>

      <DeleteRestaurantDialog
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
      <RestoreRestaurantDialog
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
      />
      <PermanentDeleteDialog
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        open={permanentOpen}
        onOpenChange={setPermanentOpen}
      />
    </>
  );
}
