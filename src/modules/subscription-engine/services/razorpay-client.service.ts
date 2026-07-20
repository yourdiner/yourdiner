import { prisma } from "@/lib/db";
import {
  getRazorpayErrorMessage,
  isRazorpayClientError,
} from "@/lib/payments/razorpay";

const RETRY_DELAYS_MS = [5000, 10000, 20000];
const TIMEOUT_MS = 15000;

const failureCounts = new Map<string, number>();

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Razorpay API timeout")), ms)
    ),
  ]);
}

export async function callRazorpay<T>(params: {
  endpoint: string;
  method?: string;
  requestBody?: unknown;
  fn: () => Promise<T>;
  maxAttempts?: number;
}): Promise<T> {
  const { endpoint, method = "POST", requestBody, fn, maxAttempts } = params;
  const retryDelays =
    maxAttempts === 1 ? [] : RETRY_DELAYS_MS.slice(0, Math.max(0, (maxAttempts ?? 4) - 1));
  let lastError: Error | null = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    const start = Date.now();
    try {
      const result = await withTimeout(fn(), TIMEOUT_MS);
      const durationMs = Date.now() - start;

      await prisma.razorpayLog.create({
        data: {
          endpoint,
          method,
          requestBody: requestBody ? (requestBody as object) : undefined,
          responseBody: { success: true } as object,
          statusCode: 200,
          durationMs,
          retryCount,
        },
      }).catch((logError) => {
        console.error("Failed to write RazorpayLog:", logError);
      });

      failureCounts.set(endpoint, 0);
      return result;
    } catch (error) {
      lastError = new Error(getRazorpayErrorMessage(error));
      const durationMs = Date.now() - start;
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? Number((error as { statusCode: number | string }).statusCode)
          : 500;

      await prisma.razorpayLog.create({
        data: {
          endpoint,
          method,
          requestBody: requestBody ? (requestBody as object) : undefined,
          statusCode,
          durationMs,
          retryCount,
          errorMessage: lastError.message,
        },
      }).catch((logError) => {
        console.error("Failed to write RazorpayLog:", logError);
      });

      if (isRazorpayClientError(error) || attempt >= retryDelays.length) {
        break;
      }

      retryCount++;
      await new Promise((r) => setTimeout(r, retryDelays[attempt]));
    }
  }

  const count = (failureCounts.get(endpoint) ?? 0) + 1;
  failureCounts.set(endpoint, count);

  if (count >= 3) {
    await notifyAdminRazorpayFailure(endpoint, lastError?.message ?? "Unknown error");
    failureCounts.set(endpoint, 0);
  }

  throw lastError ?? new Error("Razorpay API call failed");
}

async function notifyAdminRazorpayFailure(endpoint: string, error: string) {
  try {
    const { prisma: db } = await import("@/lib/db");
    const admins = await db.user.findMany({
      where: { platformRole: "SUPER_ADMIN" },
      select: { email: true },
    });

    const { sendEmail } = await import("@/lib/email");
    for (const admin of admins) {
      if (admin.email) {
        await sendEmail({
          to: admin.email,
          subject: "Razorpay API failures detected",
          html: `<p>Repeated Razorpay failures on <strong>${endpoint}</strong>: ${error}</p>`,
        });
      }
    }
  } catch {
    console.error("Failed to notify admin of Razorpay failure");
  }
}
