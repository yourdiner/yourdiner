import { PrismaClient, ReservationStatus } from "@prisma/client";

function reservationEnumReady(): boolean {
  return (
    ReservationStatus?.CHECKED_IN === "CHECKED_IN" &&
    ReservationStatus?.DINING === "DINING"
  );
}

function slowQueryThresholdMs(): number | null {
  const raw = process.env.PRISMA_SLOW_QUERY_MS;
  if (raw === "0" || raw === "off") return null;
  const parsed = Number(raw ?? "100");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  const slowMs = slowQueryThresholdMs();
  if (slowMs === null) {
    return base;
  }

  return base.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const start = performance.now();
        const result = await query(args);
        const elapsed = performance.now() - start;
        if (elapsed >= slowMs) {
          console.warn(
            `[slow-query] ${model ?? "prisma"}.${operation} ${elapsed.toFixed(1)}ms (threshold ${slowMs}ms)`
          );
        }
        return result;
      },
    },
  }) as unknown as PrismaClient;
}

/** Dev hot-reload can keep an old PrismaClient after schema changes. */
function isUsablePrismaClient(client: PrismaClient | undefined): client is PrismaClient {
  return Boolean(
    client &&
      "billingAuditLog" in client &&
      client.billingAuditLog &&
      "dailySalesSummary" in client &&
      reservationEnumReady()
  );
}

const cached = globalForPrisma.prisma;
if (cached && !isUsablePrismaClient(cached)) {
  void (cached as PrismaClient).$disconnect();
}

export const prisma = isUsablePrismaClient(cached) ? cached : createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
