"use server";

import { revalidatePath } from "next/cache";
import type { StaffRole } from "@prisma/client";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { getStaffSession } from "@/lib/staff-session";
import { AppError, getErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { parsePrinterSettings } from "./settings";
import type { PrinterSettings } from "./types";
import {
  getRecentPrintJobs,
  previewBillHtml,
  previewKotHtml,
  printBill,
  printKitchenTicket,
  retryPrintJob,
  testPrint,
} from "./printer.service";

const SETTINGS_ROLES: StaffRole[] = ["OWNER", "MANAGER"];
const BILL_PRINT_ROLES: StaffRole[] = ["OWNER", "MANAGER", "CASHIER", "STAFF"];
const KOT_PRINT_ROLES: StaffRole[] = [
  "OWNER",
  "MANAGER",
  "CASHIER",
  "KITCHEN",
  "STAFF",
];

const ROLE_RANK: Record<StaffRole, number> = {
  OWNER: 100,
  MANAGER: 80,
  CASHIER: 60,
  STAFF: 40,
  KITCHEN: 30,
  VIEWER: 10,
};

function roleAllowed(role: StaffRole, allowed: StaffRole[]): boolean {
  const min = Math.min(...allowed.map((r) => ROLE_RANK[r]));
  return ROLE_RANK[role] >= min || allowed.includes(role);
}

async function resolveRestaurantActor(allowedRoles: StaffRole[]) {
  const tenant = await requireTenantContext();

  try {
    const { staff } = await requireRestaurantStaff(tenant.restaurantId, allowedRoles);
    return { restaurantId: tenant.restaurantId, role: staff.role };
  } catch {
    const staffSession = await getStaffSession();
    if (!staffSession || staffSession.restaurantId !== tenant.restaurantId) {
      throw new AppError("Unauthorized", "FORBIDDEN", 403);
    }
    if (!roleAllowed(staffSession.role, allowedRoles)) {
      throw new AppError("Insufficient permissions", "FORBIDDEN", 403);
    }
    return { restaurantId: tenant.restaurantId, role: staffSession.role };
  }
}

export async function getPrinterSettingsAction() {
  try {
    const { restaurantId } = await resolveRestaurantActor(SETTINGS_ROLES);
    const row = await prisma.restaurantSettings.findUnique({
      where: { restaurantId },
      select: { printerSettings: true },
    });
    return {
      ok: true as const,
      settings: parsePrinterSettings(row?.printerSettings),
    };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function savePrinterSettingsAction(input: unknown) {
  try {
    const { restaurantId } = await resolveRestaurantActor(SETTINGS_ROLES);
    const settings = parsePrinterSettings(input) satisfies PrinterSettings;

    await prisma.restaurantSettings.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        printerSettings: settings,
      },
      update: {
        printerSettings: settings,
      },
    });

    revalidatePath("/dashboard/printers");
    revalidatePath("/admin/printers");
    return { ok: true as const, settings };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function testPrintAction(printerRole: "billing" | "kitchen" = "billing") {
  try {
    const { restaurantId } = await resolveRestaurantActor(SETTINGS_ROLES);
    const result = await testPrint(restaurantId, printerRole);
    return { ok: true as const, result };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function printBillAction(orderId: string, diningSessionId?: string) {
  try {
    const { restaurantId } = await resolveRestaurantActor(BILL_PRINT_ROLES);
    const result = await printBill(restaurantId, orderId, { diningSessionId });
    return { ok: true as const, result };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function printKotAction(orderId: string, revisionNumber?: number) {
  try {
    const { restaurantId } = await resolveRestaurantActor(KOT_PRINT_ROLES);
    const result = await printKitchenTicket(restaurantId, orderId, {
      revisionNumber,
    });
    return { ok: true as const, result };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function previewBillAction(orderId: string) {
  try {
    const { restaurantId } = await resolveRestaurantActor(BILL_PRINT_ROLES);
    const preview = await previewBillHtml(restaurantId, orderId);
    return {
      ok: true as const,
      html: preview.html,
      paperWidth: preview.snapshot.paperWidth,
    };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function previewKotAction(orderId: string, revisionNumber?: number) {
  try {
    const { restaurantId } = await resolveRestaurantActor(KOT_PRINT_ROLES);
    const preview = await previewKotHtml(restaurantId, orderId, revisionNumber);
    return {
      ok: true as const,
      html: preview.html,
      paperWidth: preview.snapshot.paperWidth,
    };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function retryPrintJobAction(jobId: string) {
  try {
    const { restaurantId } = await resolveRestaurantActor(BILL_PRINT_ROLES);
    const result = await retryPrintJob(restaurantId, jobId);
    return { ok: true as const, result };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function getPrintJobsAction() {
  try {
    const { restaurantId } = await resolveRestaurantActor(SETTINGS_ROLES);
    const jobs = await getRecentPrintJobs(restaurantId);
    return { ok: true as const, jobs };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}
