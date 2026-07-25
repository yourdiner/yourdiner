"use client";

import { formatCurrency } from "@/lib/utils";
import { formatOrderLineDisplay, parseModifierSnapshots } from "@/features/product-config";

export interface OrderLineItemProps {
  name: string;
  billDisplayName?: string | null;
  variantNameSnapshot?: string | null;
  modifiers?: unknown;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
  kitchenNotes?: string | null;
  onClick?: () => void;
  className?: string;
}

export function OrderLineItem({
  name,
  billDisplayName,
  variantNameSnapshot,
  modifiers,
  quantity,
  unitPrice,
  totalPrice,
  notes,
  kitchenNotes,
  onClick,
  className = "",
}: OrderLineItemProps) {
  const display = formatOrderLineDisplay({
    name,
    billDisplayName,
    variantNameSnapshot,
    modifiers,
    quantity,
    unitPrice,
    totalPrice,
    notes,
    kitchenNotes,
  });

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full text-left ${onClick ? "cursor-pointer hover:bg-muted/50 rounded-lg transition-colors" : ""} ${className}`}
    >
      <p className="font-medium">{display.productName}</p>
      {display.variantName && (
        <p className="text-sm text-muted-foreground">{display.variantName}</p>
      )}
      {display.modifiers.map((mod) => (
        <p key={mod} className="text-sm text-muted-foreground">
          + {mod}
        </p>
      ))}
      {(display.notes || display.kitchenNotes) && (
        <p className="text-xs text-muted-foreground italic mt-0.5">
          {display.kitchenNotes || display.notes}
        </p>
      )}
      <p className="mt-1 text-sm font-semibold">
        Qty {display.quantity} · {formatCurrency(display.totalPrice)}
      </p>
    </Wrapper>
  );
}

export function KitchenTicketItem({
  name,
  variantNameSnapshot,
  modifiers,
  quantity,
  notes,
  kitchenNotes,
}: Omit<OrderLineItemProps, "unitPrice" | "totalPrice" | "onClick">) {
  const mods = parseModifierSnapshots(modifiers);
  const note = kitchenNotes || notes;

  return (
    <li className="space-y-0.5">
      <p className="font-semibold">
        {name}
        {quantity > 1 ? ` ×${quantity}` : ""}
      </p>
      {variantNameSnapshot && <p>{variantNameSnapshot}</p>}
      {mods.map((m) => (
        <p key={m.modifierId} className="text-muted-foreground">
          + {m.name}
        </p>
      ))}
      {note && <p className="text-xs italic">Notes: {note}</p>}
    </li>
  );
}
