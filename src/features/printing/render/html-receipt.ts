import { formatCurrency } from "@/lib/utils";
import type { BillSnapshot, KotSnapshot, PrintSnapshot, TestSnapshot } from "../types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paperCss(width: "58" | "80"): string {
  const mm = width === "58" ? 48 : 72;
  return `
    .receipt { width: ${mm}mm; max-width: 100%; margin: 0 auto; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; color: #111; }
    .receipt * { box-sizing: border-box; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .muted { color: #555; font-size: 11px; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .hr { border: 0; border-top: 1px dashed #999; margin: 8px 0; }
    .item { margin: 6px 0; }
    .indent { padding-left: 12px; color: #444; font-size: 11px; }
    .logo { max-width: 64px; max-height: 64px; margin: 0 auto 6px; display: block; }
    @media print {
      @page { margin: 4mm; size: ${width}mm auto; }
      body { margin: 0; }
      .no-print { display: none !important; }
    }
  `;
}

function renderBill(s: BillSnapshot): string {
  const linesHtml = s.lines
    .map((line) => {
      const title = esc(line.billDisplayName?.trim() || line.name);
      const variant = line.variantName ? ` (${esc(line.variantName)})` : "";
      const mods = line.modifiers.map((m) => `<div class="indent">+ ${esc(m)}</div>`).join("");
      const notes = line.notes ? `<div class="indent">${esc(line.notes)}</div>` : "";
      return `<div class="item">
        <div class="row"><span>${line.quantity} x ${title}${variant}</span><span>${esc(formatCurrency(line.totalPrice))}</span></div>
        ${mods}${notes}
      </div>`;
    })
    .join("");

  const moneyRows: Array<[string, number]> = (
    [
      ["Subtotal", s.subtotal],
      ["Promotion Discount", s.promotionDiscountAmount],
      ["Discount", s.discountAmount],
      ["Tax", s.taxAmount],
      ["Delivery", s.deliveryCharges],
    ] as Array<[string, number]>
  ).filter((row) => row[1] > 0);

  const payments = s.payments
    .map(
      (p) =>
        `<div class="row"><span>${esc(p.method)}</span><span>${esc(formatCurrency(p.amount))}</span></div>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${paperCss(s.paperWidth)}</style></head><body>
  <div class="receipt">
    ${s.logoUrl ? `<img class="logo" src="${esc(s.logoUrl)}" alt=""/>` : ""}
    <div class="center bold">${esc(s.restaurantName)}</div>
    ${s.header ? `<div class="center muted">${esc(s.header)}</div>` : ""}
    ${s.addressLines.map((l) => `<div class="center muted">${esc(l)}</div>`).join("")}
    ${s.phone ? `<div class="center muted">${esc(s.phone)}</div>` : ""}
    ${s.gstNumber ? `<div class="center muted">GST: ${esc(s.gstNumber)}</div>` : ""}
    <hr class="hr"/>
    <div class="row"><span>Invoice</span><span>${esc(s.invoiceLabel)}</span></div>
    <div class="row"><span>Order</span><span>#${s.orderNumber}</span></div>
    ${s.tableLabel ? `<div class="row"><span>Table</span><span>${esc(s.tableLabel)}</span></div>` : ""}
    ${s.customerName ? `<div class="row"><span>Customer</span><span>${esc(s.customerName)}</span></div>` : ""}
    ${s.waiterName ? `<div class="row"><span>Waiter</span><span>${esc(s.waiterName)}</span></div>` : ""}
    <div class="row"><span>Date</span><span>${esc(new Date(s.printedAt).toLocaleString("en-IN"))}</span></div>
    <hr class="hr"/>
    ${linesHtml || `<div class="muted">No items</div>`}
    <hr class="hr"/>
    ${moneyRows.map(([l, v]) => `<div class="row"><span>${l}</span><span>${esc(formatCurrency(v))}</span></div>`).join("")}
    <div class="row bold"><span>Grand Total</span><span>${esc(formatCurrency(s.total))}</span></div>
    ${payments ? `<hr class="hr"/>${payments}` : ""}
    ${s.paidAmount > 0 ? `<div class="row"><span>Paid</span><span>${esc(formatCurrency(s.paidAmount))}</span></div>` : ""}
    ${s.changeAmount > 0 ? `<div class="row"><span>Change</span><span>${esc(formatCurrency(s.changeAmount))}</span></div>` : ""}
    <hr class="hr"/>
    <div class="center muted">Thank You</div>
    <div class="center muted">Visit Again</div>
    ${s.footerMessage ? `<div class="center muted" style="margin-top:6px">${esc(s.footerMessage)}</div>` : ""}
  </div>
  </body></html>`;
}

function renderKot(s: KotSnapshot): string {
  const linesHtml = s.lines
    .map((line) => {
      const variant = line.variantName ? ` (${esc(line.variantName)})` : "";
      const mods = line.modifiers.map((m) => `<div class="indent">+ ${esc(m)}</div>`).join("");
      const notes = [line.kitchenNotes, line.notes].filter(Boolean).join(" · ");
      return `<div class="item">
        <div class="bold">${line.quantity} x ${esc(line.name)}${variant}</div>
        ${mods}
        ${notes ? `<div class="indent">${esc(notes)}</div>` : ""}
        <div class="muted">${esc(line.status)}</div>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${paperCss(s.paperWidth)}</style></head><body>
  <div class="receipt">
    <div class="center bold">${esc(s.restaurantName)}</div>
    <div class="center bold">${esc(s.header || "KITCHEN")}</div>
    <hr class="hr"/>
    <div class="row"><span>Order</span><span>#${s.orderNumber}</span></div>
    ${s.revisionNumber != null ? `<div class="row"><span>Ticket</span><span>#${s.revisionNumber}</span></div>` : ""}
    ${s.tableLabel ? `<div class="row"><span>Table</span><span>${esc(s.tableLabel)}</span></div>` : ""}
    ${s.waiterName ? `<div class="row"><span>Waiter</span><span>${esc(s.waiterName)}</span></div>` : ""}
    <div class="row"><span>Time</span><span>${esc(new Date(s.printedAt).toLocaleString("en-IN"))}</span></div>
    <hr class="hr"/>
    ${linesHtml || `<div class="muted">No kitchen items</div>`}
    ${s.footerMessage ? `<hr class="hr"/><div class="center muted">${esc(s.footerMessage)}</div>` : ""}
  </div>
  </body></html>`;
}

function renderTest(s: TestSnapshot): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${paperCss(s.paperWidth)}</style></head><body>
  <div class="receipt">
    <div class="center bold">${esc(s.restaurantName)}</div>
    <div class="center bold">${esc(s.header || "Printer Test")}</div>
    <hr class="hr"/>
    <div class="row"><span>Printer</span><span>${esc(s.printerName)}</span></div>
    <div class="row"><span>Connection</span><span>${esc(s.connectionType)}</span></div>
    <div class="row"><span>Paper</span><span>${esc(s.paperWidth)}mm</span></div>
    <div class="row"><span>Time</span><span>${esc(new Date(s.printedAt).toLocaleString("en-IN"))}</span></div>
    <hr class="hr"/>
    <div class="center">*** TEST PRINT ***</div>
    ${s.footerMessage ? `<div class="center muted">${esc(s.footerMessage)}</div>` : ""}
  </div>
  </body></html>`;
}

export function renderSnapshotHtml(snapshot: PrintSnapshot): string {
  if (snapshot.kind === "bill") return renderBill(snapshot);
  if (snapshot.kind === "kot") return renderKot(snapshot);
  return renderTest(snapshot);
}
