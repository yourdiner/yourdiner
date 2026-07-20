/** Production safety checks — validates critical env without changing secret values. */

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`FATAL: Missing required environment variable: ${name}`);
  }
  return value;
}

function assertProductionDatabaseUrl(databaseUrl: string): void {
  const lower = databaseUrl.toLowerCase();
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) {
    throw new Error(
      "FATAL: DATABASE_URL must not point to localhost in production"
    );
  }
  if (lower.includes("restaurant:restaurant@")) {
    throw new Error(
      "FATAL: Default Docker database credentials must not be used in production"
    );
  }
}

export function assertProductionEnvSafe(): void {
  if (process.env.NODE_ENV !== "production") return;

  if (process.env.ENABLE_DEV_LOGIN === "true") {
    throw new Error("FATAL: ENABLE_DEV_LOGIN must not be enabled in production");
  }

  if (process.env.BILLING_SKIP_PAYMENT === "true") {
    throw new Error("FATAL: BILLING_SKIP_PAYMENT must not be enabled in production");
  }

  const databaseUrl = requireEnv("DATABASE_URL");
  requireEnv("DIRECT_URL");
  assertProductionDatabaseUrl(databaseUrl);

  const authSecret = requireEnv("BETTER_AUTH_SECRET");
  if (authSecret.length < 32) {
    throw new Error(
      "FATAL: BETTER_AUTH_SECRET must be at least 32 characters in production"
    );
  }

  requireEnv("CRON_SECRET");
  requireEnv("NEXT_PUBLIC_APP_URL");
  requireEnv("NEXT_PUBLIC_ROOT_DOMAIN");

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN!.toLowerCase();
  if (root.includes("localhost")) {
    console.warn(
      "[WARN] NEXT_PUBLIC_ROOT_DOMAIN is localhost in production — set your real root domain before public launch"
    );
  }

  if (
    !process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  ) {
    console.warn(
      "[WARN] UPSTASH_REDIS_REST_URL/TOKEN not set — auth rate limits are per-instance only (not shared)"
    );
  }
}

export function isBillingSkipPaymentEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.BILLING_SKIP_PAYMENT === "true";
}
