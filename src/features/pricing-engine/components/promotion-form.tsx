"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import {
  createPromotion,
  updatePromotion,
  previewPromotion,
} from "@/features/pricing-engine/actions";

const TYPES = [
  { value: "TIME_PRICE", label: "Happy Hour (time price)" },
  { value: "DAY_PRICE", label: "Day-based price" },
  { value: "COMBO", label: "Combo meal" },
  { value: "PERCENT", label: "Percentage discount" },
  { value: "FLAT", label: "Flat discount" },
  { value: "BILL_PERCENT", label: "Bill % discount" },
  { value: "BILL_FLAT", label: "Bill flat discount" },
] as const;

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

type PickerProduct = { id: string; name: string; categoryId: string; price: number };
type PickerCategory = { id: string; name: string };

type PromotionFormProps = {
  mode: "create" | "edit";
  promotionId?: string;
  initial?: Record<string, unknown>;
  categories: PickerCategory[];
  products: PickerProduct[];
};

function paiseToRupeeInput(paise: number | null | undefined): string {
  if (paise == null) return "";
  return (paise / 100).toFixed(2);
}

function rupeeInputToPaise(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || value.trim() === "") return null;
  return Math.round(n * 100);
}

export function PromotionForm({
  mode,
  promotionId,
  initial,
  categories,
  products,
}: PromotionFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [name, setName] = useState(String(initial?.name ?? ""));
  const [description, setDescription] = useState(String(initial?.description ?? ""));
  const [billLabel, setBillLabel] = useState(String(initial?.billLabel ?? ""));
  const [type, setType] = useState(String(initial?.type ?? "TIME_PRICE"));
  const [targetScope, setTargetScope] = useState(String(initial?.targetScope ?? "PRODUCTS"));
  const [priority, setPriority] = useState(Number(initial?.priority ?? 50));
  const [stackable, setStackable] = useState(Boolean(initial?.stackable ?? false));
  const [isActive, setIsActive] = useState(initial?.isActive !== false);
  const [startDate, setStartDate] = useState(
    initial?.startDate ? new Date(String(initial.startDate)).toISOString().slice(0, 10) : ""
  );
  const [endDate, setEndDate] = useState(
    initial?.endDate ? new Date(String(initial.endDate)).toISOString().slice(0, 10) : ""
  );
  const [startTime, setStartTime] = useState(String(initial?.startTime ?? ""));
  const [endTime, setEndTime] = useState(String(initial?.endTime ?? ""));
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    Array.isArray(initial?.daysOfWeek) ? (initial.daysOfWeek as number[]) : []
  );
  const [fixedPrice, setFixedPrice] = useState(
    paiseToRupeeInput(initial?.fixedPricePaise as number | null)
  );
  const [percentOff, setPercentOff] = useState(
    initial?.percentOff != null ? String(initial.percentOff) : ""
  );
  const [flatOff, setFlatOff] = useState(paiseToRupeeInput(initial?.flatOffPaise as number | null));
  const [minOrder, setMinOrder] = useState(
    paiseToRupeeInput(initial?.minOrderAmountPaise as number | null)
  );
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => {
    const targets = (initial?.targets as Array<{ productId?: string | null }>) ?? [];
    return targets.map((t) => t.productId).filter(Boolean) as string[];
  });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(() => {
    const targets = (initial?.targets as Array<{ categoryId?: string | null }>) ?? [];
    return targets.map((t) => t.categoryId).filter(Boolean) as string[];
  });
  const [comboProductIds, setComboProductIds] = useState<string[]>(() => {
    const comps =
      (initial?.comboComponents as Array<{ productId: string }>) ?? [];
    return comps.map((c) => c.productId);
  });
  const [dayBands, setDayBands] = useState<Array<{ days: number[]; price: string }>>(() => {
    const bands =
      (initial?.dayPrices as Array<{ daysOfWeek: number[]; fixedPricePaise: number }>) ?? [];
    if (!bands.length) return [{ days: [5, 6], price: "" }];
    return bands.map((b) => ({
      days: b.daysOfWeek,
      price: paiseToRupeeInput(b.fixedPricePaise),
    }));
  });
  const [previewProductId, setPreviewProductId] = useState(products[0]?.id ?? "");

  const showProductPicker = targetScope === "PRODUCTS" && !type.startsWith("BILL_") && type !== "COMBO";
  const showCategoryPicker =
    targetScope === "CATEGORIES" && !type.startsWith("BILL_") && type !== "COMBO";

  const payload = useMemo(() => {
    const targets =
      targetScope === "PRODUCTS"
        ? selectedProductIds.map((productId) => ({ productId, categoryId: null }))
        : targetScope === "CATEGORIES"
          ? selectedCategoryIds.map((categoryId) => ({ productId: null, categoryId }))
          : [];

    return {
      name,
      description: description || null,
      billLabel: billLabel || null,
      type,
      targetScope: type === "COMBO" || type.startsWith("BILL_") ? "ENTIRE_MENU" : targetScope,
      priority,
      stackable,
      isActive,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      startTime: startTime || null,
      endTime: endTime || null,
      daysOfWeek,
      fixedPricePaise: rupeeInputToPaise(fixedPrice),
      percentOff: percentOff === "" ? null : Number(percentOff),
      flatOffPaise: rupeeInputToPaise(flatOff),
      minOrderAmountPaise: rupeeInputToPaise(minOrder),
      targets,
      comboComponents: comboProductIds.map((productId, i) => ({
        productId,
        quantity: 1,
        sortOrder: i,
      })),
      dayPrices: dayBands
        .filter((b) => b.days.length && b.price !== "")
        .map((b) => ({
          daysOfWeek: b.days,
          fixedPricePaise: rupeeInputToPaise(b.price) ?? 0,
        })),
    };
  }, [
    name,
    description,
    billLabel,
    type,
    targetScope,
    priority,
    stackable,
    isActive,
    startDate,
    endDate,
    startTime,
    endTime,
    daysOfWeek,
    fixedPrice,
    percentOff,
    flatOff,
    minOrder,
    selectedProductIds,
    selectedCategoryIds,
    comboProductIds,
    dayBands,
  ]);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function toggleId(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result =
        mode === "edit" && promotionId
          ? await updatePromotion(promotionId, payload)
          : await createPromotion(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/promotions");
      router.refresh();
    });
  }

  function onPreview() {
    if (!promotionId || !previewProductId) return;
    startTransition(async () => {
      const result = await previewPromotion(promotionId, previewProductId);
      if (!result.ok) {
        setPreview(result.error);
        return;
      }
      setPreview(
        `${result.preview.productName}: ${formatCurrency(result.preview.originalUnitPrice)} → ${formatCurrency(result.preview.unitPrice)}` +
          (result.preview.discountPaise
            ? ` (save ${formatCurrency(result.preview.discountPaise)})`
            : "")
      );
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="billLabel">Bill label (combos)</Label>
          <Input
            id="billLabel"
            value={billLabel}
            onChange={(e) => setBillLabel(e.target.value)}
            placeholder="Burger Combo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority (higher first)</Label>
          <Input
            id="priority"
            type="number"
            min={0}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-6 pt-6">
          <div className="flex items-center gap-2">
            <Switch checked={stackable} onCheckedChange={setStackable} id="stackable" />
            <Label htmlFor="stackable">Stackable</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
            <Label htmlFor="active">Active</Label>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Start date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>End date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Start time</Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>End time</Label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Days of week (empty = all)</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <Button
              key={d.value}
              type="button"
              size="sm"
              variant={daysOfWeek.includes(d.value) ? "default" : "outline"}
              onClick={() => toggleDay(d.value)}
            >
              {d.label}
            </Button>
          ))}
        </div>
      </div>

      {(type === "TIME_PRICE" || type === "COMBO") && (
        <div className="space-y-2">
          <Label>{type === "COMBO" ? "Combo price (₹)" : "Promo price (₹)"}</Label>
          <Input value={fixedPrice} onChange={(e) => setFixedPrice(e.target.value)} inputMode="decimal" />
        </div>
      )}

      {(type === "PERCENT" || type === "BILL_PERCENT") && (
        <div className="space-y-2">
          <Label>Percent off</Label>
          <Input value={percentOff} onChange={(e) => setPercentOff(e.target.value)} inputMode="decimal" />
        </div>
      )}

      {(type === "FLAT" || type === "BILL_FLAT") && (
        <div className="space-y-2">
          <Label>Flat off (₹)</Label>
          <Input value={flatOff} onChange={(e) => setFlatOff(e.target.value)} inputMode="decimal" />
        </div>
      )}

      {(type === "BILL_FLAT" || type === "BILL_PERCENT") && (
        <div className="space-y-2">
          <Label>Minimum bill (₹)</Label>
          <Input value={minOrder} onChange={(e) => setMinOrder(e.target.value)} inputMode="decimal" />
        </div>
      )}

      {type === "DAY_PRICE" && (
        <div className="space-y-3">
          <Label>Day price bands</Label>
          {dayBands.map((band, idx) => (
            <div key={idx} className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <Button
                    key={d.value}
                    type="button"
                    size="sm"
                    variant={band.days.includes(d.value) ? "default" : "outline"}
                    onClick={() => {
                      setDayBands((prev) =>
                        prev.map((b, i) =>
                          i === idx
                            ? {
                                ...b,
                                days: b.days.includes(d.value)
                                  ? b.days.filter((x) => x !== d.value)
                                  : [...b.days, d.value].sort(),
                              }
                            : b
                        )
                      );
                    }}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
              <Input
                placeholder="Price ₹"
                value={band.price}
                onChange={(e) =>
                  setDayBands((prev) =>
                    prev.map((b, i) => (i === idx ? { ...b, price: e.target.value } : b))
                  )
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDayBands((p) => [...p, { days: [], price: "" }])}
          >
            Add band
          </Button>
        </div>
      )}

      {type !== "COMBO" && !type.startsWith("BILL_") && (
        <div className="space-y-2">
          <Label>Applies to</Label>
          <Select value={targetScope} onValueChange={setTargetScope}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRODUCTS">Selected products</SelectItem>
              <SelectItem value="CATEGORIES">Selected categories</SelectItem>
              <SelectItem value="ENTIRE_MENU">Entire menu</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {showProductPicker && (
        <div className="space-y-2">
          <Label>Products</Label>
          <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedProductIds.includes(p.id)}
                  onChange={() => toggleId(selectedProductIds, p.id, setSelectedProductIds)}
                />
                <span>
                  {p.name} · {formatCurrency(p.price)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {showCategoryPicker && (
        <div className="space-y-2">
          <Label>Categories</Label>
          <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCategoryIds.includes(c.id)}
                  onChange={() => toggleId(selectedCategoryIds, c.id, setSelectedCategoryIds)}
                />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {type === "COMBO" && (
        <div className="space-y-2">
          <Label>Combo products (pick at least 2)</Label>
          <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={comboProductIds.includes(p.id)}
                  onChange={() => toggleId(comboProductIds, p.id, setComboProductIds)}
                />
                <span>
                  {p.name} · {formatCurrency(p.price)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {mode === "edit" && promotionId && (
        <div className="rounded-md border p-3 space-y-2">
          <Label>Preview on product</Label>
          <div className="flex flex-wrap gap-2">
            <Select value={previewProductId} onValueChange={setPreviewProductId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={onPreview} disabled={pending}>
              Preview
            </Button>
          </div>
          {preview && <p className="text-sm text-muted-foreground">{preview}</p>}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create promotion"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/promotions")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
