import { sortByPriorityDesc } from "./targeting";
import type { ComboLineInput, ComboMatchedLine, EnginePromotion } from "./types";

function newComboGroupId(): string {
  return `combo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Greedy auto-match of COMBO promotions against cart lines.
 * Explicit combo lines (comboGroupId set + explicitCombo) are left untouched.
 * Prices are redistributed so component totals sum to combo fixed price.
 */
export function matchCombos(
  lines: ComboLineInput[],
  promotions: EnginePromotion[]
): ComboMatchedLine[] {
  const combos = sortByPriorityDesc(promotions).filter(
    (p) => p.type === "COMBO" && p.comboComponents.length >= 2 && (p.fixedPricePaise ?? 0) >= 0
  );

  // Working mutable copies
  type Work = ComboMatchedLine & { remaining: number; locked: boolean };
  const work: Work[] = lines.map((l) => ({
    ...l,
    remaining: l.quantity,
    locked: Boolean(l.comboGroupId && l.explicitCombo),
    comboGroupId: l.comboGroupId ?? null,
    billDisplayName: l.billDisplayName ?? null,
    promotionId: l.promotionId ?? null,
    promotionNameSnapshot: l.promotionNameSnapshot ?? null,
    promotionDiscountPaise: l.promotionDiscountPaise ?? 0,
    originalUnitPrice: l.originalUnitPrice,
    unitPrice: l.unitPrice,
    totalPrice: l.totalPrice,
  }));

  // Clear previous auto-matched combos so we can rematch
  for (const w of work) {
    if (!w.locked && w.comboGroupId) {
      w.comboGroupId = null;
      w.billDisplayName = null;
      // Restore pre-combo unit if we have original
      if (w.originalUnitPrice > 0) {
        w.unitPrice = w.originalUnitPrice;
        w.totalPrice = w.unitPrice * w.quantity;
      }
      w.promotionId = null;
      w.promotionNameSnapshot = null;
      w.promotionDiscountPaise = 0;
      w.remaining = w.quantity;
    }
  }

  for (const combo of combos) {
    const components = [...combo.comboComponents].sort((a, b) => a.sortOrder - b.sortOrder);
    const comboPrice = combo.fixedPricePaise ?? 0;
    const billLabel = combo.billLabel || combo.name;

    // How many full combo sets can we form?
    let sets = Infinity;
    for (const c of components) {
      const available = work
        .filter((w) => !w.locked && w.productId === c.productId && !w.comboGroupId)
        .reduce((s, w) => s + w.remaining, 0);
      sets = Math.min(sets, Math.floor(available / Math.max(1, c.quantity)));
    }
    if (!Number.isFinite(sets) || sets <= 0) continue;

    for (let s = 0; s < sets; s++) {
      const groupId = newComboGroupId();
      const claimed: { line: Work; qty: number; shareOriginal: number }[] = [];

      for (const c of components) {
        let need = c.quantity;
        for (const w of work) {
          if (need <= 0) break;
          if (w.locked || w.comboGroupId || w.productId !== c.productId || w.remaining <= 0) {
            continue;
          }
          const take = Math.min(need, w.remaining);
          w.remaining -= take;
          need -= take;
          claimed.push({
            line: w,
            qty: take,
            shareOriginal: w.originalUnitPrice * take,
          });
        }
        if (need > 0) {
          // Shouldn't happen if sets computed correctly — abort this set
          for (const cl of claimed) {
            cl.line.remaining += cl.qty;
          }
          claimed.length = 0;
          break;
        }
      }

      if (!claimed.length) break;

      const originalSum = claimed.reduce((s, c) => s + c.shareOriginal, 0);
      let allocated = 0;

      claimed.forEach((cl, idx) => {
        const isLast = idx === claimed.length - 1;
        let lineTotal: number;
        if (originalSum <= 0) {
          lineTotal = isLast
            ? comboPrice - allocated
            : Math.floor(comboPrice / claimed.length);
        } else if (isLast) {
          lineTotal = comboPrice - allocated;
        } else {
          lineTotal = Math.floor((comboPrice * cl.shareOriginal) / originalSum);
        }
        allocated += lineTotal;

        const unit = Math.floor(lineTotal / Math.max(1, cl.qty));
        // If line was partially claimed, we need to split — for simplicity require
        // full-line claim when possible. When partial, adjust that line's pricing
        // for the claimed portion by splitting into combo pricing on whole quantity
        // only when entire remaining was claimed.
        const line = cl.line;
        const discount = Math.max(0, cl.shareOriginal - lineTotal);

        if (cl.qty === line.quantity && line.remaining === 0) {
          line.comboGroupId = groupId;
          line.billDisplayName = billLabel;
          line.unitPrice = unit;
          line.totalPrice = lineTotal;
          line.promotionId = combo.id;
          line.promotionNameSnapshot = combo.name;
          line.promotionDiscountPaise = discount;
        } else {
          // Partial claim on a merged qty line: apply weighted average unit
          const unclaimedQty = line.quantity - cl.qty;
          const unclaimedTotal = line.originalUnitPrice * unclaimedQty;
          const newTotal = lineTotal + unclaimedTotal;
          line.comboGroupId = groupId;
          line.billDisplayName = billLabel;
          line.unitPrice = Math.floor(newTotal / Math.max(1, line.quantity));
          line.totalPrice = newTotal;
          line.promotionId = combo.id;
          line.promotionNameSnapshot = combo.name;
          line.promotionDiscountPaise =
            Math.max(0, line.originalUnitPrice * line.quantity - newTotal);
          // Mark remaining as consumed for further matching on this product portion
        }
      });
    }
  }

  return work.map(({ remaining: _r, locked: _l, ...rest }) => rest);
}

/**
 * Apply explicit combo pricing to a set of component lines (same quantities as recipe × sets).
 */
export function applyExplicitComboPricing(
  lines: Array<{
    productId: string;
    quantity: number;
    originalUnitPrice: number;
    name: string;
  }>,
  combo: EnginePromotion,
  comboGroupId: string
): ComboMatchedLine[] {
  const comboPrice = combo.fixedPricePaise ?? 0;
  const billLabel = combo.billLabel || combo.name;
  const originalSum = lines.reduce((s, l) => s + l.originalUnitPrice * l.quantity, 0);
  let allocated = 0;

  return lines.map((l, idx) => {
    const share = l.originalUnitPrice * l.quantity;
    const isLast = idx === lines.length - 1;
    let lineTotal: number;
    if (originalSum <= 0) {
      lineTotal = isLast ? comboPrice - allocated : Math.floor(comboPrice / lines.length);
    } else if (isLast) {
      lineTotal = comboPrice - allocated;
    } else {
      lineTotal = Math.floor((comboPrice * share) / originalSum);
    }
    allocated += lineTotal;
    const unit = Math.floor(lineTotal / Math.max(1, l.quantity));
    return {
      productId: l.productId,
      quantity: l.quantity,
      name: l.name,
      originalUnitPrice: l.originalUnitPrice,
      unitPrice: unit,
      totalPrice: lineTotal,
      comboGroupId,
      billDisplayName: billLabel,
      promotionId: combo.id,
      promotionNameSnapshot: combo.name,
      promotionDiscountPaise: Math.max(0, share - lineTotal),
      explicitCombo: true,
    };
  });
}
