"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Minus, Plus, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  type ConfigurableProduct,
  type ProductSelection,
  priceSelection,
  validateSelection,
  getVariantGroups,
  getActiveModifierGroups,
  getDisplayFromPrice,
} from "@/features/product-config";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type ConfiguratorConfirmPayload = ProductSelection;

interface ProductConfiguratorSheetProps {
  product: ConfigurableProduct;
  open: boolean;
  onClose: () => void;
  onConfirm: (selection: ConfiguratorConfirmPayload) => void;
  confirmLabel?: string;
  showNotes?: boolean;
  showConfirmButton?: boolean;
  /** When false, hide quantity stepper and price as single unit (browse-only). */
  showQuantity?: boolean;
  initialSelection?: Partial<ProductSelection>;
  presentation?: "sheet" | "dialog";
}

export function ProductConfiguratorSheet({
  product,
  open,
  onClose,
  onConfirm,
  confirmLabel = "Add to Cart",
  showNotes = false,
  showConfirmButton = true,
  showQuantity = true,
  initialSelection,
  presentation = "sheet",
}: ProductConfiguratorSheetProps) {
  const [variantId, setVariantId] = useState<string>("");
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset whenever the sheet opens so a second add (e.g. Large after Regular)
  // never inherits the previous variant/modifier selection.
  const initialModsKey = (initialSelection?.modifierIds ?? []).slice().sort().join(",");
  useEffect(() => {
    if (!open) return;
    setVariantId(initialSelection?.variantId ?? "");
    setModifierIds(initialSelection?.modifierIds ? [...initialSelection.modifierIds] : []);
    setQuantity(initialSelection?.quantity ?? 1);
    setNotes(initialSelection?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset from snapshot when sheet opens / product or seed changes
  }, [open, product.id, initialSelection?.variantId, initialSelection?.quantity, initialSelection?.notes, initialModsKey]);

  const effectiveQuantity = showQuantity ? quantity : 1;

  const selection: ProductSelection = useMemo(
    () => ({
      variantId: variantId || null,
      modifierIds,
      quantity: effectiveQuantity,
      notes,
    }),
    [variantId, modifierIds, effectiveQuantity, notes]
  );

  const priced = useMemo(() => priceSelection(product, selection), [product, selection]);
  const validation = useMemo(() => validateSelection(product, selection), [product, selection]);

  const variantGroups = getVariantGroups(product);
  const modifierGroups = getActiveModifierGroups(product);

  const toggleModifier = (id: string, groupMax: number) => {
    setModifierIds((prev) => {
      if (prev.includes(id)) return prev.filter((m) => m !== id);
      const groupMods = prev.filter((mid) => {
        const g = modifierGroups.find((gr) => gr.modifiers.some((m) => m.id === mid));
        const targetGroup = modifierGroups.find((gr) => gr.modifiers.some((m) => m.id === id));
        return g?.id === targetGroup?.id;
      });
      if (groupMax > 0 && groupMods.length >= groupMax) {
        return prev;
      }
      return [...prev, id];
    });
  };

  if (!open || !mounted) return null;

  // Above .pm-overlay (z-index: 75) so the sheet stays usable when the order panel is open.
  const shellClass =
    presentation === "dialog"
      ? "fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      : "fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center sm:p-4";

  const panelClass =
    presentation === "dialog"
      ? "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
      : "max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl";

  const sheet = (
    <div className={shellClass} onClick={onClose} role="dialog" aria-modal="true">
      <div className={panelClass} onClick={(e) => e.stopPropagation()}>
        {product.images?.[0] && (
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={product.images[0].media.url}
              alt={product.name}
              fill
              className="object-cover"
            />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{product.name}</h2>
              {product.description && (
                <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
              )}
            </div>
            {!product.images?.[0] && (
              <button type="button" onClick={onClose} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {variantGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <Label>
                {group.name}
                {group.isRequired && <span className="text-destructive"> *</span>}
              </Label>
              <div className="space-y-2">
                {group.variants.map((v) => (
                  <label
                    key={v.id}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
                      variantId === v.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`variant-${product.id}-${group.id}`}
                        checked={variantId === v.id}
                        onChange={() => setVariantId(v.id)}
                        className="h-4 w-4"
                      />
                      {v.name}
                    </span>
                    <span className="font-medium">{formatCurrency(v.price)}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {modifierGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <Label>
                {group.name}
                {group.isRequired ? (
                  <span className="text-destructive"> *</span>
                ) : (
                  <span className="text-muted-foreground"> (Optional)</span>
                )}
              </Label>
              <div className="space-y-2">
                {group.modifiers.map((m) => (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
                      modifierIds.includes(m.id) ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={modifierIds.includes(m.id)}
                        onChange={() =>
                          toggleModifier(m.id, group.maxSelect > 0 ? group.maxSelect : 99)
                        }
                        className="h-4 w-4 rounded"
                      />
                      {m.name}
                    </span>
                    {m.price > 0 && (
                      <span className="font-medium">+{formatCurrency(m.price)}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {showNotes && (
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions..."
                rows={2}
              />
            </div>
          )}

          {showQuantity && (
            <div className="flex items-center justify-between">
              <Label>Quantity</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-semibold">{quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            {priced.variantName && (
              <div className="flex justify-between">
                <span>{priced.variantName}</span>
                <span>{formatCurrency(priced.variantPrice ?? 0)}</span>
              </div>
            )}
            {!priced.variantName && variantGroups.length === 0 && (
              <div className="flex justify-between">
                <span>Base</span>
                <span>{formatCurrency(getDisplayFromPrice(product))}</span>
              </div>
            )}
            {priced.modifiers.map((m) => (
              <div key={m.modifierId} className="flex justify-between text-muted-foreground">
                <span>+ {m.name}</span>
                <span>+{formatCurrency(m.price)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>{showQuantity ? "Total" : "Price"}</span>
              <span>{formatCurrency(priced.totalPrice)}</span>
            </div>
          </div>

          {!validation.valid && showConfirmButton && (
            <p className="text-sm text-destructive">{validation.errors[0]}</p>
          )}

          {showConfirmButton ? (
            <Button
              type="button"
              className="w-full"
              disabled={!validation.valid}
              onClick={() => onConfirm(selection)}
            >
              {confirmLabel} · {formatCurrency(priced.totalPrice)}
            </Button>
          ) : (
            <Button type="button" variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
