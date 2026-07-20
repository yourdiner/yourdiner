/**
 * KVM2 / self-hosted cron runner.
 *
 * Usage:
 *   CRON_SECRET=... APP_URL=http://127.0.0.1:3000 npx tsx scripts/run-cron.ts subscriptions
 *   CRON_SECRET=... APP_URL=http://127.0.0.1:3000 npx tsx scripts/run-cron.ts billing-sync
 *   CRON_SECRET=... APP_URL=http://127.0.0.1:3000 npx tsx scripts/run-cron.ts all
 *
 * Example crontab (daily 02:00 subscriptions, every 6 hours billing sync):
 *   0 2 * * * cd /path/to/app && CRON_SECRET=xxx APP_URL=http://127.0.0.1:3000 npx tsx scripts/run-cron.ts subscriptions >> /var/log/cafe-pos-cron.log 2>&1
 *   0 0,6,12,18 * * * cd /path/to/app && CRON_SECRET=xxx APP_URL=http://127.0.0.1:3000 npx tsx scripts/run-cron.ts billing-sync >> /var/log/cafe-pos-cron.log 2>&1
 */

const job = process.argv[2] ?? "all";
const baseUrl = (process.env.APP_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET is required");
  process.exit(1);
}

const endpoints: Record<string, string> = {
  subscriptions: "/api/cron/subscriptions",
  "billing-sync": "/api/cron/billing-sync",
};

async function run(path: string) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${body}`);
  }
  console.log(`[${new Date().toISOString()}] ${path} OK: ${body}`);
}

async function main() {
  if (job === "all") {
    await run(endpoints.subscriptions);
    await run(endpoints["billing-sync"]);
    return;
  }

  const path = endpoints[job];
  if (!path) {
    console.error(`Unknown job: ${job}. Use subscriptions | billing-sync | all`);
    process.exit(1);
  }

  await run(path);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
