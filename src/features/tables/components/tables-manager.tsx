"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  createTable,
  updateTable,
  deleteTable,
  getNextTableNumber,
  generateTableCustomerQr,
} from "@/lib/table-client";
import { generateQRImageDataUrl } from "@/lib/qr-client";
import type { TableFormValues } from "@/features/tables/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredLabel } from "@/components/ui/required-label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, QrCode, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

type TableRecord = {
  id: string;
  number: number;
  name: string;
  capacity: number;
  shape: string;
  status: string;
  availabilityStatus: string;
  qrCodes: { id: string }[];
  sessions: { id: string }[];
};

const SHAPES = ["SQUARE", "ROUND", "RECTANGLE", "CUSTOM"] as const;
const OPERATIONAL_STATUSES = ["AVAILABLE", "CLEANING", "DISABLED"] as const;

const STATUS_BADGE_STYLES: Record<string, string> = {
  AVAILABLE: "border-emerald-300 bg-emerald-100 text-emerald-800",
  OCCUPIED: "border-red-300 bg-red-100 text-red-800",
  RESERVED: "border-amber-300 bg-amber-100 text-amber-800",
  CLEANING: "border-slate-300 bg-slate-100 text-slate-700",
  DISABLED: "border-slate-300 bg-slate-100 text-slate-700",
};

const EMPTY_FORM: TableFormValues = {
  number: 1,
  name: "",
  capacity: 4,
  shape: "SQUARE",
  status: "AVAILABLE",
};

function formatLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function TablesManager({
  tables,
  canGenerateTableQr = false,
}: {
  tables: TableRecord[];
  canGenerateTableQr?: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TableRecord | null>(null);
  const [form, setForm] = useState<TableFormValues>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrTable, setQrTable] = useState<TableRecord | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const openCreate = async () => {
    setEditing(null);
    try {
      const result = await getNextTableNumber();
      const nextNumber = result.ok ? result.data.number : 1;
      setForm({
        ...EMPTY_FORM,
        number: nextNumber,
        name: `Table ${nextNumber}`,
      });
    } catch {
      setForm({ ...EMPTY_FORM, name: "Table 1" });
    }
    setDialogOpen(true);
  };

  const openEdit = (table: TableRecord) => {
    setEditing(table);
    const operationalStatus = ["CLEANING", "DISABLED"].includes(table.status)
      ? table.status
      : "AVAILABLE";
    setForm({
      number: table.number,
      name: table.name,
      capacity: table.capacity,
      shape: table.shape as TableFormValues["shape"],
      status: operationalStatus as TableFormValues["status"],
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = editing
        ? await updateTable(editing.id, form)
        : await createTable(form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Table updated" : "Table created");
      setDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (table: TableRecord) => {
    if (!confirm(`Remove Table ${table.number}? This cannot be undone.`)) return;
    try {
      const result = await deleteTable(table.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Table removed");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleGenerateQr = async (table: TableRecord) => {
    setQrTable(table);
    setQrUrl(null);
    setQrImage(null);
    setQrDialogOpen(true);
    setQrLoading(true);
    try {
      const result = await generateTableCustomerQr(table.id);
      if (!result.ok) {
        toast.error(result.error);
        setQrDialogOpen(false);
        return;
      }
      setQrUrl(result.data.url);
      const dataUrl = await generateQRImageDataUrl(result.data.url);
      setQrImage(dataUrl);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
      setQrDialogOpen(false);
    } finally {
      setQrLoading(false);
    }
  };

  const copyQrUrl = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const downloadQrImage = () => {
    if (!qrImage || !qrTable) return;
    const link = document.createElement("a");
    link.href = qrImage;
    link.download = `table-${qrTable.number}-order-qr.png`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Table
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tables.map((table) => (
          <Card key={table.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">Table {table.number}</CardTitle>
                  <p className="text-sm text-muted-foreground">{table.name}</p>
                </div>
                <Badge
                  variant="outline"
                  className={STATUS_BADGE_STYLES[table.availabilityStatus] ?? ""}
                >
                  {formatLabel(table.availabilityStatus)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capacity</span>
                  <span>{table.capacity} seats</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shape</span>
                  <span>{formatLabel(table.shape)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">QR link</span>
                  <span className="text-xs">Permanent</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                {canGenerateTableQr ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleGenerateQr(table)}
                  >
                    <QrCode className="mr-1.5 h-3.5 w-3.5" />
                    View Table QR
                  </Button>
                ) : (
                  <p className="rounded border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
                    Table QR codes require a plan with customer QR ordering.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEdit(table)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(table)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tables.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          No tables yet. Add your first table to get started.
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Table" : "Add Table"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <RequiredLabel htmlFor="table-number">Number</RequiredLabel>
                <Input
                  id="table-number"
                  type="number"
                  min={1}
                  value={form.number}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      number: Number(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="table-capacity">Capacity</RequiredLabel>
                <Input
                  id="table-capacity"
                  type="number"
                  min={1}
                  max={50}
                  value={form.capacity}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      capacity: Number(e.target.value) || 1,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <RequiredLabel htmlFor="table-name">Name</RequiredLabel>
              <Input
                id="table-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Window Booth"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Shape</Label>
                <Select
                  value={form.shape}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      shape: value as TableFormValues["shape"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHAPES.map((shape) => (
                      <SelectItem key={shape} value={shape}>
                        {formatLabel(shape)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      status: value as TableFormValues["status"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATIONAL_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading ? "Saving..." : editing ? "Save Changes" : "Create Table"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {qrTable ? `Table QR — Table ${qrTable.number}` : "Table QR"}
            </DialogTitle>
          </DialogHeader>
          {qrLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading QR...</p>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                This link is permanent for this table. Print and place the QR on the table — it does
                not expire or rotate.
              </p>
              {qrImage && (
                <div className="flex justify-center">
                  <Image
                    src={qrImage}
                    alt="Table order QR code"
                    width={200}
                    height={200}
                    unoptimized
                  />
                </div>
              )}
              {qrUrl && (
                <p className="break-all text-center text-xs text-muted-foreground">{qrUrl}</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={copyQrUrl} disabled={!qrUrl}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy Link
                </Button>
                <Button variant="outline" className="flex-1" onClick={downloadQrImage} disabled={!qrImage}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
