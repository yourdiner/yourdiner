import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const NEXT_DIR = join(ROOT, ".next");
const BUDGET_PATH = join(ROOT, "performance", "bundle-budget.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function chunkSizeKb(chunkPath) {
  const normalized = chunkPath.startsWith("static/") ? chunkPath : `static/${chunkPath}`;
  const fullPath = join(NEXT_DIR, normalized);
  if (!existsSync(fullPath)) {
    return 0;
  }
  return statSync(fullPath).size / 1024;
}

function routePatternMatches(routeKey, pattern) {
  const normalized = routeKey.replace(/\/page$/, "").replace(/\/route$/, "") || "/";
  if (pattern === normalized) return true;
  return normalized.startsWith(`${pattern}/`);
}

function estimateRouteFirstLoadKb(manifest, routeKey) {
  const chunks = new Set([
    ...(manifest.rootMainFiles ?? []),
    ...(manifest.pages?.[routeKey] ?? []),
  ]);

  let total = 0;
  for (const chunk of chunks) {
    total += chunkSizeKb(chunk);
  }
  return total;
}

function findRouteKeys(manifest) {
  return Object.keys(manifest.pages ?? {});
}

function fail(message) {
  console.error(`bundle-budget: ${message}`);
  process.exit(1);
}

if (!existsSync(NEXT_DIR)) {
  fail("Missing .next directory. Run `npm run build` first.");
}

if (!existsSync(BUDGET_PATH)) {
  fail("Missing performance/bundle-budget.json");
}

const budget = readJson(BUDGET_PATH);
const manifestPath = join(NEXT_DIR, "app-build-manifest.json");
if (!existsSync(manifestPath)) {
  fail("Missing .next/app-build-manifest.json");
}

const manifest = readJson(manifestPath);
const routeKeys = findRouteKeys(manifest);
const violations = [];

let totalClientKb = 0;
const countedChunks = new Set();
for (const chunk of manifest.rootMainFiles ?? []) {
  if (!countedChunks.has(chunk)) {
    countedChunks.add(chunk);
    totalClientKb += chunkSizeKb(chunk);
  }
}
for (const chunks of Object.values(manifest.pages ?? {})) {
  for (const chunk of chunks) {
    if (!countedChunks.has(chunk)) {
      countedChunks.add(chunk);
      totalClientKb += chunkSizeKb(chunk);
    }
  }
}

if (budget.maxTotalClientJsKb && totalClientKb > budget.maxTotalClientJsKb) {
  violations.push(
    `total client JS ${totalClientKb.toFixed(1)} kB exceeds budget ${budget.maxTotalClientJsKb} kB`
  );
}

for (const [pattern, maxKb] of Object.entries(budget.routes ?? {})) {
  const matches = routeKeys.filter((routeKey) => routePatternMatches(routeKey, pattern));
  if (matches.length === 0) {
    console.warn(`bundle-budget: no build routes matched pattern ${pattern}`);
    continue;
  }

  const observed = Math.max(...matches.map((routeKey) => estimateRouteFirstLoadKb(manifest, routeKey)));
  if (observed > maxKb) {
    violations.push(`${pattern} first-load estimate ${observed.toFixed(1)} kB exceeds ${maxKb} kB`);
  }
}

if (violations.length > 0) {
  console.error("bundle-budget: budget exceeded:");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log(
  `bundle-budget: ok (total client JS ~${totalClientKb.toFixed(1)} kB, ${routeKeys.length} routes)`
);
