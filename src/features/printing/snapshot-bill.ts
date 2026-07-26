import "server-only";

import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getRestaurantBrandingCached } from "@/lib/request-cache";
import { parseModifierSnapshots } from "@/features/product-config";
import { getRestaurantPrinterSettings } from "./settings-server";
import type { BillSnapshot, KotSnapshot, TestSnapshot } from "./types";

function formatAddress(branding: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}): string[] {
  const lines: string[] = [];
  if (branding.address?.trim()) lines.push(branding.address.trim());
  const cityLine = [branding.city, branding.state, branding.postalCode]
    .filter(Boolean)
    .join(", ");
  if (cityLine) lines.push(cityLine);
  return lines;
}

function moneyNowIso() {
  return new Date().toISOString();
}

export async function buildBillSnapshot(
  restaurantId: string,
  orderId: string
): Promise<BillSnapshot> {
  const [order, restaurant, branding, printerSettings] = await Promise.all([
    prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        table: { select: { name: true, number: true } },
        customer: { select: { name: true } },
        staff: { select: { displayName: true } },
        deliveryDetails: { select: { deliveryCharges: true } },
        payments: { where: { status: "COMPLETED" } },
        diningSession: {
          select: {
            guestName: true,
            staff: { select: { displayName: true } },
            payments: { where: { status: "COMPLETED" } },
          },
        },
      },
    }),
    prisma.restaurant.findFirst({
      where: { id: restaurantId },
      select: { name: true },
    }),
    getRestaurantBrandingCached(restaurantId),
    getRestaurantPrinterSettings(restaurantId),
  ]);

  if (!order || !restaurant) {
    throw new AppError("Order not found", "NOT_FOUND", 404);
  }

  const endpoint = printerSettings.billingPrinter;
  const sessionPayments = order.diningSession?.payments ?? [];
  const orderPayments = order.payments ?? [];
  const payments = [
    ...sessionPayments.map((p) => ({
      method: String(p.method),
      amount: p.amount,
      status: String(p.status),
    })),
    ...orderPayments.map((p) => ({
      method: String(p.method),
      amount: p.amount,
      status: String(p.status),
    })),
  ];
  const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
  const changeAmount = Math.max(0, paidAmount - order.total);

  const billableStatuses = new Set(["SENT", "PREPARING", "READY", "SERVED"]);
  const lines = order.items
    .filter((i) => billableStatuses.has(i.kitchenStatus) || order.orderType !== "DINE_IN")
    .map((item) => {
      const mods = parseModifierSnapshots(item.modifiers);
      return {
        name: item.name,
        billDisplayName: item.billDisplayName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        variantName: item.variantNameSnapshot,
        modifiers: mods.map((m) => m.name),
        notes: item.notes ?? item.kitchenNotes,
      };
    });

  return {
    kind: "bill",
    restaurantName: restaurant.name,
    logoUrl: endpoint.printLogo ? branding?.logo?.url ?? null : null,
    addressLines: branding ? formatAddress(branding) : [],
    phone: branding?.phone ?? null,
    gstNumber: branding?.gstNumber ?? null,
    header: endpoint.header ?? null,
    footerMessage:
      endpoint.footerMessage?.trim() ||
      branding?.receiptFooter?.trim() ||
      "Thank you! Visit again",
    orderNumber: order.orderNumber,
    invoiceLabel: `INV-${order.orderNumber}`,
    orderType: order.orderType,
    tableLabel: order.table
      ? order.table.name || `Table ${order.table.number}`
      : null,
    customerName:
      order.customer?.name ||
      order.customerName ||
      order.diningSession?.guestName ||
      null,
    waiterName:
      order.staff?.displayName || order.diningSession?.staff?.displayName || null,
    printedAt: moneyNowIso(),
    lines,
    subtotal: order.subtotal,
    promotionDiscountAmount: order.promotionDiscountAmount ?? 0,
    discountAmount: order.discountAmount ?? 0,
    taxAmount: order.taxAmount ?? 0,
    deliveryCharges: order.deliveryDetails?.deliveryCharges ?? 0,
    total: order.total,
    payments,
    paidAmount,
    changeAmount,
    paperWidth: endpoint.paperWidth,
  };
}

export async function buildKotSnapshot(
  restaurantId: string,
  orderId: string,
  options?: { revisionNumber?: number }
): Promise<KotSnapshot> {
  const [order, restaurant, printerSettings] = await Promise.all([
    prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        table: { select: { name: true, number: true } },
        staff: { select: { displayName: true } },
        diningSession: {
          select: { staff: { select: { displayName: true } } },
        },
      },
    }),
    prisma.restaurant.findFirst({
      where: { id: restaurantId },
      select: { name: true },
    }),
    getRestaurantPrinterSettings(restaurantId),
  ]);

  if (!order || !restaurant) {
    throw new AppError("Order not found", "NOT_FOUND", 404);
  }

  const sentStatuses = new Set(["SENT", "PREPARING", "READY", "SERVED"]);
  let items = order.items.filter((i) => sentStatuses.has(i.kitchenStatus));
  if (options?.revisionNumber != null) {
    items = items.filter((i) => i.revisionNumber === options.revisionNumber);
  }

  const endpoint = printerSettings.kitchenPrinter;

  return {
    kind: "kot",
    restaurantName: restaurant.name,
    header: endpoint.header ?? "KITCHEN",
    footerMessage: endpoint.footerMessage ?? null,
    orderNumber: order.orderNumber,
    tableLabel: order.table
      ? order.table.name || `Table ${order.table.number}`
      : order.orderType,
    waiterName:
      order.staff?.displayName || order.diningSession?.staff?.displayName || null,
    printedAt: moneyNowIso(),
    revisionNumber: options?.revisionNumber ?? null,
    lines: items.map((item) => {
      const mods = parseModifierSnapshots(item.modifiers);
      return {
        name: item.name,
        quantity: item.quantity,
        variantName: item.variantNameSnapshot,
        modifiers: mods.map((m) => m.name),
        notes: item.notes,
        kitchenNotes: item.kitchenNotes,
        status: item.kitchenStatus,
      };
    }),
    paperWidth: endpoint.paperWidth,
  };
}

export async function buildTestSnapshot(
  restaurantId: string,
  printerRole: "billing" | "kitchen"
): Promise<TestSnapshot> {
  const [restaurant, printerSettings] = await Promise.all([
    prisma.restaurant.findFirst({
      where: { id: restaurantId },
      select: { name: true },
    }),
    getRestaurantPrinterSettings(restaurantId),
  ]);
  if (!restaurant) throw new AppError("Restaurant not found", "NOT_FOUND", 404);

  const endpoint =
    printerRole === "kitchen"
      ? printerSettings.kitchenPrinter
      : printerSettings.billingPrinter;

  return {
    kind: "test",
    restaurantName: restaurant.name,
    printerName: endpoint.name,
    connectionType: endpoint.connectionType,
    paperWidth: endpoint.paperWidth,
    printedAt: moneyNowIso(),
    header: endpoint.header ?? "Printer Test",
    footerMessage: endpoint.footerMessage ?? "Test print OK",
  };
}
