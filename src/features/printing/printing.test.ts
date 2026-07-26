import { describe, expect, it } from "vitest";
import { renderSnapshotHtml } from "./render/html-receipt";
import { renderSnapshotEscPos } from "./render/escpos-receipt";
import type { BillSnapshot, KotSnapshot } from "./types";

const bill: BillSnapshot = {
  kind: "bill",
  restaurantName: "Test Cafe",
  addressLines: ["123 Main St"],
  phone: "9999999999",
  gstNumber: "GST123",
  orderNumber: 1001,
  invoiceLabel: "INV-1001",
  orderType: "DINE_IN",
  tableLabel: "T1",
  customerName: "Guest",
  waiterName: "Ravi",
  printedAt: new Date().toISOString(),
  lines: [
    {
      name: "Cold Coffee",
      quantity: 2,
      unitPrice: 15000,
      totalPrice: 30000,
      variantName: "Large",
      modifiers: ["Ice Cream"],
    },
  ],
  subtotal: 30000,
  promotionDiscountAmount: 0,
  discountAmount: 0,
  taxAmount: 1500,
  deliveryCharges: 0,
  total: 31500,
  payments: [{ method: "CASH", amount: 31500, status: "COMPLETED" }],
  paidAmount: 31500,
  changeAmount: 0,
  paperWidth: "80",
  footerMessage: "Thank you",
};

const kot: KotSnapshot = {
  kind: "kot",
  restaurantName: "Test Cafe",
  header: "KITCHEN",
  orderNumber: 1001,
  tableLabel: "T1",
  printedAt: new Date().toISOString(),
  lines: [
    {
      name: "Cold Coffee",
      quantity: 2,
      variantName: "Large",
      modifiers: ["Ice Cream"],
      kitchenNotes: "Less sugar",
      status: "SENT",
    },
  ],
  paperWidth: "58",
};

describe("receipt renderers", () => {
  it("renders bill HTML with totals and no recalculation markers beyond snapshot", () => {
    const html = renderSnapshotHtml(bill);
    expect(html).toContain("Test Cafe");
    expect(html).toContain("Cold Coffee");
    expect(html).toContain("Grand Total");
    expect(html).not.toContain("₹NaN");
  });

  it("renders thermal @page and receipt width for 80mm bill", () => {
    const html = renderSnapshotHtml(bill);
    expect(html).toContain("@page");
    expect(html).toContain("size: 80mm auto");
    expect(html).toContain("margin: 0");
    expect(html).toContain("width: 80mm");
    expect(html).toContain('data-paper-width="80"');
    expect(html).toContain("page-break-inside: avoid");
    expect(html).toContain("break-inside: avoid");
  });

  it("renders thermal @page and receipt width for 58mm KOT", () => {
    const html = renderSnapshotHtml(kot);
    expect(html).toContain("size: 58mm auto");
    expect(html).toContain("width: 58mm");
    expect(html).toContain('data-paper-width="58"');
    expect(html).toContain("page-break-inside: avoid");
    expect(html).toContain("break-inside: avoid");
  });

  it("renders KOT HTML without currency prices", () => {
    const html = renderSnapshotHtml(kot);
    expect(html).toContain("KITCHEN");
    expect(html).toContain("Less sugar");
    expect(html).not.toContain("Grand Total");
    expect(html).not.toContain("Subtotal");
  });

  it("renders ESC/POS base64 for bill and kot", () => {
    const billEsc = renderSnapshotEscPos(bill, { cut: true, drawer: false });
    const kotEsc = renderSnapshotEscPos(kot, { cut: true, drawer: false });
    expect(billEsc.length).toBeGreaterThan(20);
    expect(kotEsc.length).toBeGreaterThan(20);
    expect(Buffer.from(billEsc, "base64").toString("utf8")).toContain("TOTAL");
    expect(Buffer.from(kotEsc, "base64").toString("utf8")).toContain("KITCHEN");
  });
});
