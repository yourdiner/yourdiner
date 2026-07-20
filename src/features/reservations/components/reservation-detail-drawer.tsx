"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getReservationDetailApi,
  reservationMutateApi,
  updateReservationApi,
  type ReservationDetail,
} from "@/lib/reservation-client";

type TableOption = {
  id: string;
  name: string;
  number: number;
  capacity: number;
};

type Props = {
  reservationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tables?: TableOption[];
};

export function ReservationDetailDrawer({
  reservationId,
  open,
  onOpenChange,
  tables = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [detail, setDetail] = useState<ReservationDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    guestName: "",
    guestPhone: "",
    guestCount: 2,
    date: "",
    time: "",
    tableId: "",
    specialRequest: "",
  });

  useEffect(() => {
    if (!open) {
      setEditing(false);
      return;
    }
    getReservationDetailApi(reservationId).then((result) => {
      setDetail(result.ok ? result.data : null);
    });
  }, [open, reservationId]);

  useEffect(() => {
    if (!detail || !editing) return;
    const d = new Date(detail.reservedAt);
    setEditForm({
      guestName: detail.guestName,
      guestPhone: detail.guestPhone,
      guestCount: detail.guestCount,
      date: d.toISOString().slice(0, 10),
      time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      tableId: detail.table?.id ?? "",
      specialRequest: detail.specialRequest ?? "",
    });
  }, [detail, editing]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          throw new Error(result.error ?? "Action failed");
        }
        toast.success(success);
        router.refresh();
        const updated = await getReservationDetailApi(reservationId);
        setDetail(updated.ok ? updated.data : null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  };

  const handleSaveEdit = () => {
    startTransition(async () => {
      try {
        const reservedAt = new Date(`${editForm.date}T${editForm.time}:00`).toISOString();
        const result = await updateReservationApi(reservationId, {
          guestName: editForm.guestName,
          guestPhone: editForm.guestPhone,
          guestCount: editForm.guestCount,
          reservedAt,
          tableId: editForm.tableId || null,
          specialRequest: editForm.specialRequest || undefined,
        });
        if (!result.ok) throw new Error(result.error ?? "Update failed");
        toast.success("Reservation updated");
        setEditing(false);
        router.refresh();
        const updated = await getReservationDetailApi(reservationId);
        setDetail(updated.ok ? updated.data : null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      }
    });
  };

  const canEdit = detail && ["PENDING", "CONFIRMED"].includes(detail.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{detail?.guestName ?? "Reservation"}</DialogTitle>
        </DialogHeader>
        {!detail ? (
          <p className="py-8 text-center text-muted-foreground">Loading...</p>
        ) : editing ? (
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <Label>Customer name</Label>
              <Input
                value={editForm.guestName}
                onChange={(e) => setEditForm({ ...editForm, guestName: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input
                  value={editForm.guestPhone}
                  onChange={(e) => setEditForm({ ...editForm, guestPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Guests</Label>
                <Input
                  type="number"
                  min={1}
                  value={editForm.guestCount}
                  onChange={(e) =>
                    setEditForm({ ...editForm, guestCount: Number(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={editForm.time}
                  onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                />
              </div>
            </div>
            {tables.length > 0 && (
              <div className="space-y-2">
                <Label>Table</Label>
                <Select
                  value={editForm.tableId}
                  onValueChange={(v) => setEditForm({ ...editForm, tableId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name || `Table ${t.number}`} ({t.capacity} seats)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.specialRequest}
                onChange={(e) => setEditForm({ ...editForm, specialRequest: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button disabled={pending} onClick={handleSaveEdit}>
                {pending ? "Saving..." : "Save changes"}
              </Button>
              <Button variant="outline" disabled={pending} onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground">Phone</Label>
                <p>{detail.guestPhone}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Guests</Label>
                <p>{detail.guestCount}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Time</Label>
                <p>{formatDateTime(detail.reservedAt)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p>{detail.status.replace(/_/g, " ")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Table</Label>
                <p>
                  {detail.table?.name ||
                    (detail.table ? `Table ${detail.table.number}` : "—")}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Source</Label>
                <p>{detail.source}</p>
              </div>
            </div>

            {detail.specialRequest && (
              <div>
                <Label className="text-muted-foreground">Notes</Label>
                <p>{detail.specialRequest}</p>
              </div>
            )}

            {detail.diningSessionId && (
              <Link
                href={`/admin/orders/${detail.diningSessionId}`}
                className="text-primary underline"
              >
                View dining session
              </Link>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-4">
              {canEdit && (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
              {detail.status === "PENDING" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => reservationMutateApi(detail.id, "confirm"), "Confirmed")}
                >
                  Confirm
                </Button>
              )}
              {detail.status === "CONFIRMED" && (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => reservationMutateApi(detail.id, "checkIn"), "Checked in")}
                >
                  Check In
                </Button>
              )}
              {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(detail.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => reservationMutateApi(detail.id, "cancel"), "Cancelled")}
                >
                  Cancel
                </Button>
              )}
              {detail.status === "CONFIRMED" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => reservationMutateApi(detail.id, "noShow"), "No show")}
                >
                  No Show
                </Button>
              )}
            </div>

            <div className="border-t pt-4">
              <Label className="text-muted-foreground">Activity</Label>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {detail.events.map((e) => (
                  <li key={e.id} className="rounded border p-2 text-xs">
                    <p className="font-medium">{e.type.replace(/_/g, " ")}</p>
                    <p className="text-muted-foreground">{e.message}</p>
                    <p className="text-muted-foreground">{formatDateTime(e.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
