import "server-only";

import { PrintJobStatus, PrintJobType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { renderSnapshotHtml } from "./render/html-receipt";
import { renderSnapshotEscPos } from "./render/escpos-receipt";
import { getProviderForConnection } from "./providers";
import { getRestaurantPrinterSettings } from "./settings";
import {
  buildBillSnapshot,
  buildKotSnapshot,
  buildTestSnapshot,
} from "./snapshot-bill";
import type { PrintSnapshot, PrinterEndpointConfig, PrinterRole } from "./types";

export type EnqueuePrintResult = {
  jobId: string;
  status: PrintJobStatus;
  html?: string;
  mode?: string;
  errorMessage?: string | null;
  needsBrowserPrint: boolean;
};

async function dispatchJob(input: {
  restaurantId: string;
  jobId: string;
  endpoint: PrinterEndpointConfig;
  snapshot: PrintSnapshot;
  html: string;
  escPosBase64: string;
}): Promise<EnqueuePrintResult> {
  const provider = getProviderForConnection(input.endpoint.connectionType);

  await prisma.printJob.update({
    where: { id: input.jobId },
    data: {
      status: PrintJobStatus.PRINTING,
      attempts: { increment: 1 },
    },
  });

  const result = await provider.print({
    restaurantId: input.restaurantId,
    endpoint: input.endpoint,
    snapshot: input.snapshot,
    html: input.html,
    escPosBase64: input.escPosBase64,
  });

  const status = result.ok ? PrintJobStatus.COMPLETED : PrintJobStatus.FAILED;
  await prisma.printJob.update({
    where: { id: input.jobId },
    data: {
      status,
      errorMessage: result.errorMessage ?? null,
      completedAt: result.ok ? new Date() : null,
    },
  });

  return {
    jobId: input.jobId,
    status,
    html: result.html ?? input.html,
    mode: result.mode,
    errorMessage: result.errorMessage ?? null,
    needsBrowserPrint: result.mode === "browser" && result.ok,
  };
}

async function createAndDispatch(input: {
  restaurantId: string;
  type: PrintJobType;
  printerRole: PrinterRole;
  endpoint: PrinterEndpointConfig;
  snapshot: PrintSnapshot;
  orderId?: string;
  diningSessionId?: string;
  revisionNumber?: number;
}): Promise<EnqueuePrintResult> {
  const html = renderSnapshotHtml(input.snapshot);
  const escPosBase64 = renderSnapshotEscPos(input.snapshot, {
    cut: input.endpoint.autoCut,
    drawer: input.endpoint.cashDrawerTrigger,
  });

  const job = await prisma.printJob.create({
    data: {
      restaurantId: input.restaurantId,
      type: input.type,
      status: PrintJobStatus.QUEUED,
      printerRole: input.printerRole,
      connectionType: input.endpoint.connectionType,
      orderId: input.orderId,
      diningSessionId: input.diningSessionId,
      revisionNumber: input.revisionNumber,
      payloadJson: input.snapshot as unknown as Prisma.InputJsonValue,
      htmlPreview: html,
      escPosBase64,
    },
  });

  try {
    // Repeat for copies > 1 for agent/browser; browser client can print once
    let last = await dispatchJob({
      restaurantId: input.restaurantId,
      jobId: job.id,
      endpoint: input.endpoint,
      snapshot: input.snapshot,
      html,
      escPosBase64,
    });

    const extraCopies = Math.max(0, (input.endpoint.copies || 1) - 1);
    if (
      extraCopies > 0 &&
      input.endpoint.connectionType === "LAN" &&
      last.status === PrintJobStatus.COMPLETED
    ) {
      for (let i = 0; i < extraCopies; i++) {
        last = await dispatchJob({
          restaurantId: input.restaurantId,
          jobId: job.id,
          endpoint: { ...input.endpoint, copies: 1 },
          snapshot: input.snapshot,
          html,
          escPosBase64,
        });
      }
    }

    return last;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Print failed";
    await prisma.printJob.update({
      where: { id: job.id },
      data: { status: PrintJobStatus.FAILED, errorMessage: message },
    });
    return {
      jobId: job.id,
      status: PrintJobStatus.FAILED,
      html,
      errorMessage: message,
      needsBrowserPrint: false,
    };
  }
}

export async function printBill(
  restaurantId: string,
  orderId: string,
  options?: { diningSessionId?: string }
): Promise<EnqueuePrintResult> {
  const settings = await getRestaurantPrinterSettings(restaurantId);
  const endpoint = settings.billingPrinter;
  const snapshot = await buildBillSnapshot(restaurantId, orderId);
  return createAndDispatch({
    restaurantId,
    type: PrintJobType.BILL,
    printerRole: "billing",
    endpoint,
    snapshot,
    orderId,
    diningSessionId: options?.diningSessionId,
  });
}

export async function printKitchenTicket(
  restaurantId: string,
  orderId: string,
  options?: { revisionNumber?: number; diningSessionId?: string }
): Promise<EnqueuePrintResult> {
  const settings = await getRestaurantPrinterSettings(restaurantId);
  const endpoint = settings.kitchenPrinter;
  const snapshot = await buildKotSnapshot(restaurantId, orderId, {
    revisionNumber: options?.revisionNumber,
  });

  if (!snapshot.lines.length) {
    return {
      jobId: "",
      status: PrintJobStatus.COMPLETED,
      errorMessage: null,
      needsBrowserPrint: false,
    };
  }

  return createAndDispatch({
    restaurantId,
    type: PrintJobType.KOT,
    printerRole: "kitchen",
    endpoint,
    snapshot,
    orderId,
    diningSessionId: options?.diningSessionId,
    revisionNumber: options?.revisionNumber,
  });
}

export async function printReceipt(
  restaurantId: string,
  orderId: string
): Promise<EnqueuePrintResult> {
  return printBill(restaurantId, orderId);
}

export async function testPrint(
  restaurantId: string,
  printerRole: "billing" | "kitchen" = "billing"
): Promise<EnqueuePrintResult> {
  const settings = await getRestaurantPrinterSettings(restaurantId);
  const endpoint =
    printerRole === "kitchen" ? settings.kitchenPrinter : settings.billingPrinter;
  const snapshot = await buildTestSnapshot(restaurantId, printerRole);
  return createAndDispatch({
    restaurantId,
    type: PrintJobType.TEST,
    printerRole,
    endpoint,
    snapshot,
  });
}

/** Fire-and-forget wrappers — never throw into order/payment flows. */
export function enqueueAutoPrintBill(restaurantId: string, orderId: string, diningSessionId?: string) {
  void (async () => {
    try {
      const settings = await getRestaurantPrinterSettings(restaurantId);
      if (!settings.autoPrintCustomerBills || !settings.billingPrinter.enabled) return;
      await printBill(restaurantId, orderId, { diningSessionId });
    } catch (error) {
      console.error("[printing] auto bill failed", error);
    }
  })();
}

export function enqueueAutoPrintKot(
  restaurantId: string,
  orderId: string,
  options?: { revisionNumber?: number; diningSessionId?: string }
) {
  void (async () => {
    try {
      const settings = await getRestaurantPrinterSettings(restaurantId);
      if (!settings.autoPrintKitchenTickets || !settings.kitchenPrinter.enabled) return;
      await printKitchenTicket(restaurantId, orderId, options);
    } catch (error) {
      console.error("[printing] auto KOT failed", error);
    }
  })();
}

export async function retryPrintJob(restaurantId: string, jobId: string): Promise<EnqueuePrintResult> {
  const job = await prisma.printJob.findFirst({
    where: { id: jobId, restaurantId },
  });
  if (!job) {
    return {
      jobId,
      status: PrintJobStatus.FAILED,
      errorMessage: "Print job not found",
      needsBrowserPrint: false,
    };
  }

  const settings = await getRestaurantPrinterSettings(restaurantId);
  const endpoint =
    job.printerRole === "kitchen" ? settings.kitchenPrinter : settings.billingPrinter;
  const snapshot = job.payloadJson as unknown as PrintSnapshot;
  const html = job.htmlPreview || renderSnapshotHtml(snapshot);
  const escPosBase64 =
    job.escPosBase64 ||
    renderSnapshotEscPos(snapshot, {
      cut: endpoint.autoCut,
      drawer: endpoint.cashDrawerTrigger,
    });

  return dispatchJob({
    restaurantId,
    jobId: job.id,
    endpoint,
    snapshot,
    html,
    escPosBase64,
  });
}

export async function getRecentPrintJobs(restaurantId: string, take = 20) {
  return prisma.printJob.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      status: true,
      printerRole: true,
      connectionType: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
      orderId: true,
    },
  });
}

export async function previewBillHtml(restaurantId: string, orderId: string) {
  const snapshot = await buildBillSnapshot(restaurantId, orderId);
  return { html: renderSnapshotHtml(snapshot), snapshot };
}

export async function previewKotHtml(
  restaurantId: string,
  orderId: string,
  revisionNumber?: number
) {
  const snapshot = await buildKotSnapshot(restaurantId, orderId, { revisionNumber });
  return { html: renderSnapshotHtml(snapshot), snapshot };
}
