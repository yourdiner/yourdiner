import { formatCurrency } from "@/lib/utils";
import type { BillSnapshot, KotSnapshot, PrintSnapshot, TestSnapshot } from "../types";

/** Minimal ESC/POS encoder (text + cut + drawer). No vendor SDK. */
class EscPosBuilder {
  private chunks: number[] = [];

  raw(...bytes: number[]) {
    this.chunks.push(...bytes);
    return this;
  }

  text(s: string) {
    for (let i = 0; i < s.length; i++) {
      this.chunks.push(s.charCodeAt(i) & 0xff);
    }
    return this;
  }

  println(s = "") {
    return this.text(s).raw(0x0a);
  }

  align(mode: "left" | "center" | "right") {
    const n = mode === "center" ? 1 : mode === "right" ? 2 : 0;
    return this.raw(0x1b, 0x61, n);
  }

  bold(on: boolean) {
    return this.raw(0x1b, 0x45, on ? 1 : 0);
  }

  init() {
    return this.raw(0x1b, 0x40);
  }

  cut() {
    return this.raw(0x1d, 0x56, 0x00);
  }

  openDrawer() {
    // Standard cash drawer pulse on pin 2
    return this.raw(0x1b, 0x70, 0x00, 0x19, 0x19);
  }

  separator(width: number) {
    return this.println("-".repeat(width));
  }

  toBase64(): string {
    const bytes = Uint8Array.from(this.chunks);
    if (typeof Buffer !== "undefined") {
      return Buffer.from(bytes).toString("base64");
    }
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }
}

function cols(width: "58" | "80"): number {
  return width === "58" ? 32 : 48;
}

function row(label: string, value: string, width: number): string {
  const space = Math.max(1, width - label.length - value.length);
  return `${label}${" ".repeat(space)}${value}`.slice(0, width);
}

function renderBillEscPos(s: BillSnapshot, opts: { cut: boolean; drawer: boolean }): string {
  const w = cols(s.paperWidth);
  const b = new EscPosBuilder().init().align("center").bold(true);
  b.println(s.restaurantName);
  b.bold(false);
  if (s.header) b.println(s.header);
  s.addressLines.forEach((l) => b.println(l));
  if (s.phone) b.println(s.phone);
  if (s.gstNumber) b.println(`GST: ${s.gstNumber}`);
  b.align("left").separator(w);
  b.println(row("Invoice", s.invoiceLabel, w));
  b.println(row("Order", `#${s.orderNumber}`, w));
  if (s.tableLabel) b.println(row("Table", s.tableLabel, w));
  if (s.customerName) b.println(row("Customer", s.customerName, w));
  if (s.waiterName) b.println(row("Waiter", s.waiterName, w));
  b.println(new Date(s.printedAt).toLocaleString("en-IN"));
  b.separator(w);
  for (const line of s.lines) {
    const title = line.billDisplayName?.trim() || line.name;
    const left = `${line.quantity}x ${title}${line.variantName ? ` (${line.variantName})` : ""}`;
    b.println(row(left.slice(0, w - 10), formatCurrency(line.totalPrice), w));
    line.modifiers.forEach((m) => b.println(`  + ${m}`));
    if (line.notes) b.println(`  ${line.notes}`);
  }
  b.separator(w);
  if (s.subtotal) b.println(row("Subtotal", formatCurrency(s.subtotal), w));
  if (s.promotionDiscountAmount)
    b.println(row("Promotion", `-${formatCurrency(s.promotionDiscountAmount)}`, w));
  if (s.discountAmount) b.println(row("Discount", `-${formatCurrency(s.discountAmount)}`, w));
  if (s.taxAmount) b.println(row("Tax", formatCurrency(s.taxAmount), w));
  if (s.deliveryCharges) b.println(row("Delivery", formatCurrency(s.deliveryCharges), w));
  b.bold(true).println(row("TOTAL", formatCurrency(s.total), w)).bold(false);
  for (const p of s.payments) {
    b.println(row(p.method, formatCurrency(p.amount), w));
  }
  if (s.paidAmount) b.println(row("Paid", formatCurrency(s.paidAmount), w));
  if (s.changeAmount) b.println(row("Change", formatCurrency(s.changeAmount), w));
  b.separator(w).align("center").println("Thank You").println("Visit Again");
  if (s.footerMessage) b.println(s.footerMessage);
  if (opts.drawer) b.openDrawer();
  if (opts.cut) b.cut();
  return b.toBase64();
}

function renderKotEscPos(s: KotSnapshot, opts: { cut: boolean }): string {
  const w = cols(s.paperWidth);
  const b = new EscPosBuilder().init().align("center").bold(true);
  b.println(s.restaurantName);
  b.println(s.header || "KITCHEN");
  b.bold(false).align("left").separator(w);
  b.println(row("Order", `#${s.orderNumber}`, w));
  if (s.revisionNumber != null) b.println(row("Ticket", `#${s.revisionNumber}`, w));
  if (s.tableLabel) b.println(row("Table", s.tableLabel, w));
  if (s.waiterName) b.println(row("Waiter", s.waiterName, w));
  b.println(new Date(s.printedAt).toLocaleString("en-IN"));
  b.separator(w);
  for (const line of s.lines) {
    b.bold(true)
      .println(
        `${line.quantity}x ${line.name}${line.variantName ? ` (${line.variantName})` : ""}`
      )
      .bold(false);
    line.modifiers.forEach((m) => b.println(`  + ${m}`));
    const notes = [line.kitchenNotes, line.notes].filter(Boolean).join(" · ");
    if (notes) b.println(`  ${notes}`);
    b.println(`  [${line.status}]`);
  }
  if (s.footerMessage) b.separator(w).align("center").println(s.footerMessage);
  if (opts.cut) b.cut();
  return b.toBase64();
}

function renderTestEscPos(s: TestSnapshot, opts: { cut: boolean }): string {
  const w = cols(s.paperWidth);
  const b = new EscPosBuilder().init().align("center").bold(true);
  b.println(s.restaurantName);
  b.println(s.header || "Printer Test");
  b.bold(false).align("left").separator(w);
  b.println(row("Printer", s.printerName, w));
  b.println(row("Connection", s.connectionType, w));
  b.println(row("Paper", `${s.paperWidth}mm`, w));
  b.println(new Date(s.printedAt).toLocaleString("en-IN"));
  b.separator(w).align("center").println("*** TEST PRINT ***");
  if (s.footerMessage) b.println(s.footerMessage);
  if (opts.cut) b.cut();
  return b.toBase64();
}

export function renderSnapshotEscPos(
  snapshot: PrintSnapshot,
  opts: { cut: boolean; drawer: boolean }
): string {
  if (snapshot.kind === "bill") return renderBillEscPos(snapshot, opts);
  if (snapshot.kind === "kot") return renderKotEscPos(snapshot, { cut: opts.cut });
  return renderTestEscPos(snapshot, { cut: opts.cut });
}
