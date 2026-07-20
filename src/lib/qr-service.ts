import { prisma } from "@/lib/db";
import {
  requireTenantContext,
  requireRestaurantStaff,
  buildRestaurantUrl,
} from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { QRCodeMode } from "@prisma/client";
import { getErrorMessage } from "@/lib/errors";
import QRCode from "qrcode";

export type ServiceResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

type QRRecord = {
  id: string;
  url: string;
  mode: string;
  token: string;
  createdAt: Date;
  invalidatedAt: Date | null;
};

export async function generateMenuQRService(): Promise<ServiceResult<QRRecord>> {
  try {
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

    return { ok: true, data: qrCode };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function regenerateQRService(qrCodeId: string): Promise<ServiceResult<QRRecord>> {
  try {
    const tenant = await requireTenantContext();
    const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

    const existing = await prisma.qRCode.findFirst({
      where: { id: qrCodeId, restaurantId: tenant.restaurantId },
    });
    if (!existing) return { ok: false, error: "QR code not found" };

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

    return { ok: true, data: newQr };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function invalidateQRService(qrCodeId: string): Promise<ServiceResult> {
  try {
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

    await prisma.qRCode.updateMany({
      where: { id: qrCodeId, restaurantId: tenant.restaurantId },
      data: { invalidatedAt: new Date() },
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function generateQRImageDataUrlService(url: string): Promise<ServiceResult<{ dataUrl: string }>> {
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
    return { ok: true, data: { dataUrl } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function searchPublicMenuService(restaurantId: string, query: string) {
  const { searchMenuProductCards } = await import("@/lib/menu-catalog");
  return searchMenuProductCards(restaurantId, query, "public");
}
