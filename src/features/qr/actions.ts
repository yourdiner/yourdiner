"use server";

import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff, buildRestaurantUrl } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { QRCodeMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";

export async function getQRCodes() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId);

  return prisma.qRCode.findMany({
    where: { restaurantId: tenant.restaurantId, invalidatedAt: null },
    include: { table: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function generateMenuQR() {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  await requirePlanFeature(tenant.restaurantId, "qr_menu");

  const menuUrl = buildRestaurantUrl(tenant, "/menu");

  const qrCode = await prisma.qRCode.create({
    data: {
      restaurantId: tenant.restaurantId,
      mode: QRCodeMode.MENU_ONLY,
      url: menuUrl,
    },
  });

  await prisma.activityLog.create({
    data: {
      restaurantId: tenant.restaurantId,
      userId: staff.userId,
      action: "CREATE",
      entity: "qr_code",
      entityId: qrCode.id,
    },
  });

  revalidatePath("/dashboard/qr-codes");
  return qrCode;
}

export async function regenerateQR(qrCodeId: string) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const existing = await prisma.qRCode.findFirst({
    where: { id: qrCodeId, restaurantId: tenant.restaurantId },
  });
  if (!existing) throw new Error("QR code not found");

  await prisma.qRCode.update({
    where: { id: qrCodeId },
    data: { invalidatedAt: new Date() },
  });

  const menuUrl = buildRestaurantUrl(tenant, "/menu");

  const newQr = await prisma.qRCode.create({
    data: {
      restaurantId: tenant.restaurantId,
      mode: existing.mode,
      tableId: existing.tableId,
      url: menuUrl,
    },
  });

  await prisma.activityLog.create({
    data: {
      restaurantId: tenant.restaurantId,
      userId: staff.userId,
      action: "UPDATE",
      entity: "qr_code",
      entityId: newQr.id,
      metadata: { regeneratedFrom: qrCodeId },
    },
  });

  revalidatePath("/dashboard/qr-codes");
  return newQr;
}

export async function invalidateQR(qrCodeId: string) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  await prisma.qRCode.updateMany({
    where: { id: qrCodeId, restaurantId: tenant.restaurantId },
    data: { invalidatedAt: new Date() },
  });

  revalidatePath("/dashboard/qr-codes");
}

export async function generateQRImageDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

export async function generateQRImageBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    width: 1024,
    margin: 2,
    type: "png",
  });
}
