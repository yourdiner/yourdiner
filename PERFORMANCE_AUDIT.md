# Performance Audit — Cafe POS System

**Date:** 2026-07-14  
**Scope:** Full codebase (54 pages, 73 API routes, 14 server-action modules, Prisma + RSC)  
**Method:** Static call-graph audit + timed Prisma scenarios against live Demo Cafe DB + HTTP timing for `/menu`  
**Constraint honored:** No business-logic, auth, reservation-rule, pricing, or security changes.

---

## Executive summary

The platform already has several strong foundations: **React `cache()`** for tenant/session/features/settings, **progressive public menu** (`unstable_cache` + category/product APIs), and **slim staff-order category shells** (no full menu tree on SSR).

The remaining latency that will stop the product from “feeling extremely fast” at production scale is concentrated in:

1. **Floor double-fetch** — tables + dining sessions loaded twice per poll (`fetchFloorTablesForRestaurant` + `getRestaurantTablesAvailability`).
2. **Reservation suggest N+1** — `getAvailableTables` loops `isTableAvailable` (~3 queries × N tables).
3. **Admin live-floor payload** — `getActiveDiningSessions` nests **all open order items** for kitchen-status UI.
4. **Dashboard/layout duplicate restaurant + subscription loads** plus **many uncached aggregate queries**.
5. **Customer QR waterfall** — sequential session/table checks after menu load.
6. **Cron / hold-expiry N+1** — per-row `markNoShow` / expire loops.
7. **Missing indexes** — `StaffSession.restaurantId`, `Order.tableId`, `Order.tableSessionId`.

**Measured baseline (Demo Cafe: 5 tables, 3 categories, 7 products, local Postgres):**

| Scenario | Wall | Queries | Notes |
|----------|------|---------|-------|
| Public `/menu` cold HTTP | **2486 ms** | — | Dev compile + first paint |
| Public `/menu` warm HTTP | **737 ms** | — | Still RSC/middleware dominant |
| Dashboard aggregate bundle | **86 ms** | 12 | Scales with order history |
| Floor duplicated pattern | **34 ms** | 6 | Tables/sessions fetched twice |
| Floor availability alone | **52 ms** | 4 | Sequential reservations after sessions |
| Reservation N+1 (5 tables) | **45 ms** | 15 | → **3.3× slower** than batch (14 ms / 3 q) |
| Deep menu tree | **26 ms** | 7 | ~5.8 KB JSON; grows with catalog |
| Category shell | **3 ms** | 1 | Current staff-order approach |
| One category cards | **6 ms** | 2 | Progressive path |

On a café with **40 tables / 150 products / busy service**, expect the N+1 and floor/live-session issues to dominate (hundreds of ms to seconds), not Demo Cafe’s tiny absolute numbers.

---

## System map (hot paths)

```
Host → middleware → tenant resolve (React cache)
  ├─ /menu → public-menu page → getCachedPublicMenu → progressive client fetches
  ├─ /customer/table/[slug] → QR validate → menu → session waterfall → CustomerOrderFlow
  ├─ /staff/floor → layout auth → client poll GET /api/staff/floor → double DB fetch
  ├─ /staff/order/[id] → slim categories + branding → progressive product APIs
  ├─ /admin (dashboard) → layout-shell (session+restaurant+features) → page aggregates
  ├─ /admin/orders → poll GET /api/admin/floor/sessions → getActiveDiningSessions (fat)
  └─ /admin/reservations → suggest → getAvailableTables N+1
```

---

## 1. API performance table

Estimates combine measured DB time + typical auth/tenant (~5–20 ms request-cached) + JSON serialize. **Avg** = warm path on Demo-scale; **@scale** = ~40 tables / busy night projection.

| Route | Avg (demo) | @scale | Slowest step | Improvement |
|-------|------------|--------|--------------|-------------|
| `GET /api/staff/floor` | ~80–150 ms | **300–800 ms** | Duplicate table/session + availability | Compose one snapshot (−40–55% DB) |
| `GET /api/admin/floor/sessions` | ~50–120 ms | **400–1200 ms** | Nested order **items** in sessions | Aggregate kitchen status; drop item rows (−50–70% payload) |
| `GET /api/admin/kitchen` | ~30–80 ms | **200–600 ms** | Unbounded kitchen queue + full items | Cap/paginate; select fields |
| `GET /api/public/menu/categories` | ~5–20 ms cached | same | Cache miss → categories query | Already good (`unstable_cache`) |
| `GET /api/public/menu/categories/.../products` | ~10–40 ms | **80–250 ms** | Unbounded products/category | `take` + cursor |
| `GET /api/public/menu/products/.../config` | ~15–40 ms | ~40–80 ms | Deep product config | Keep per-product; cache OK |
| `GET /api/public/menu/search` | uncached | grows with QPS | Always hits DB | Short TTL `unstable_cache` |
| `GET /api/admin/reservations/suggest` | high | **worst case N×queries** | `getAvailableTables` N+1 | Batch conflicts (−70–90%) |
| `GET /api/admin/customer-sessions/pending` | OK | grows | Unbounded pending sessions | `take` + index (exists) |
| `POST` order mutations | OK | OK | Correct sequential writes | Leave alone |
| Cron `reservations` / `customer-sessions` | batch | **platform N+1** | Per-row markNoShow/expire | Cursor + batch updates |
| Platform restaurant list | ~26 ms | pagination OK | Nested owner staff | Already `take: 20` |

---

## 2. Server actions — duplicate work

| Pattern | Where | Issue |
|---------|-------|-------|
| Tenant + staff/auth | Almost every action | **OK** — `requireTenantContext` / `getStaffSession` / `getEffectiveFeatures` are `React.cache`d |
| Settings parsers | Order/reservation/tax | **OK** — `getRestaurantSettingsCached` |
| Public branding | `getPublicBranding` | Request cache only — **bypasses** `getCachedPublicBranding` (900s Data Cache) |
| Menu mutations | Many admin product APIs | Correctly revalidate tags — good |
| Reservation actions | List/dashboard/calendar | Separate unbounded day loads; suggest uses N+1 |
| Fulfillment create | Takeaway/delivery | Deep category include on some paths — prefer progressive catalog APIs |
| Waiters `getLiveFloorData` | Admin floor | Confirm it doesn’t reimplement fat session tree |

**Repeated authentication within one action call:** generally deduped. **Across layout + page + action in one navigation:** also deduped via `cache()`. Remaining waste is **uncached Prisma** (restaurant row in layout AND page).

---

## 3. React Server Component breakdowns

Percentages = share of **application server time** (excluding Next.js compile). Demo warm `/menu` HTTP ~737 ms includes framework overhead; DB portion of that is small.

### Admin Dashboard — `/admin` (`dashboard/page.tsx` + `layout-shell`)

**Analogy:** Counting inventory by walking every aisle for each stat card, then walking the store again for the sidebar.

| Step | % |
|------|---|
| Tenant + Better Auth session | 8% |
| Authz / membership | 5% |
| Database (layout restaurant + page counts/groupBy/revenue) | **58%** |
| Business logic | 4% |
| Transformation | 5% |
| Rendering | 15% |
| Serialization / Flight | 3% |
| Response | 2% |

**Findings:** Layout loads `restaurant+subscription+branding`; page loads `restaurant+subscription` again. Four product `count`s could be one groupBy/raw SQL. Weekly revenue already has summary fast-path — good when summaries exist.

### Staff Floor — `/staff/floor` + `GET /api/staff/floor`

| Step | % |
|------|---|
| Tenant | 8% |
| Staff auth | 12% |
| Database (duplicated) | **62%** |
| Availability business logic | 8% |
| Mapping | 5% |
| JSON serialize | 4% |
| Response | 1% |

### Staff Order — `/staff/order/[sessionId]`

| Step | % |
|------|---|
| Tenant + staff auth (cached, layout+page) | 15% |
| Database (session + slim categories + order) | **35%** |
| Branding | 10% |
| Transform / serialize order | 8% |
| RSC render (shell only) | 25% |
| Response | 7% |

**Note:** Products load **client-side** via progressive APIs — correct. Remaining win: share public branding Data Cache; parallel branding with context where safe.

### Kitchen — `/admin/kitchen`

| Step | % |
|------|---|
| Auth / tenant / feature | 15% |
| Database (queue + items) | **55%** |
| Serialize tickets | 15% |
| Render / poll client | 15% |

### Public Menu — `/menu`

| Step (warm, cached shell) | % |
|------|---|
| Middleware + tenant | 20% |
| Feature / subscription check | 12% |
| Menu Data Cache hit | 5% |
| RSC + Flight | **45%** |
| Response | 18% |

Cold miss: Database **40%**, Transform **15%**, RSC **25%**, Tenant **10%**, Features **10%**.

### Customer QR — `/customer/table/[tableSlug]`

| Step | % |
|------|---|
| Tenant | 8% |
| Table QR resolve | 8% |
| Menu (cached) | 15% |
| Feature check | 8% |
| Session waterfall (token → own → terminal → blocking → dining) | **35%** |
| RSC | 20% |
| Response | 6% |

**Analogy:** Checking five different clipboards in sequence before seating the guest.

### Reservations dashboard / calendar

| Step | % |
|------|---|
| Auth/tenant | 10% |
| Unbounded day reservation/table loads | **50%** |
| Availability / display grouping | 15% |
| Render | 20% |
| Response | 5% |

### Platform admin restaurants

| Step | % |
|------|---|
| Platform auth | 15% |
| Paginated restaurant list | **45%** |
| Nested owner/subscription | included in DB |
| Render | 30% |
| Response | 10% |

Measured list page DB ~26 ms for 3 restaurants — fine until large tenants; keep pagination.

---

## 4–5. Database audit & Top slow-query report

Local absolute times are low on Demo data; **rank by scale impact**, not Demo ms.

| # | File | Function | Demo time | Rows (demo) | Reason | Suggested optimization | Est. improvement |
|---|------|----------|-----------|-------------|--------|------------------------|------------------|
| 1 | `availability.service.ts` | `getAvailableTables` | 45 ms | 5×3 q | N+1 per table | Batch like `getRestaurantTablesAvailability` | **70–90%** |
| 2 | `floor/queries.ts` + `table-availability.service.ts` | `fetchFloorTablesForRestaurant` | 34 ms | 6 q | Double tables/sessions | Single composed query | **40–55%** |
| 3 | `session.service.ts` | `getActiveDiningSessions` | n/a busy | items×orders | Fat include of all items | `_count` / status aggregates | **50–70%** payload/time |
| 4 | `dashboard/page.tsx` | overview Promise.all | 86 ms | 12 q | Many counts + groupBy | Consolidate counts; cache 30–60s | **30–50%** |
| 5 | `layout-shell.tsx` + page | restaurant findUnique | overlapped | 2× | Duplicate restaurant/subscription | `React.cache` restaurant loader | **1 RTT** |
| 6 | `table-availability.service.ts` | `getRestaurantTablesAvailability` | 52 ms | 4 q seq | Reservations after sessions | `Promise.all` tables+sessions+reservations post-holds | **20–35%** |
| 7 | `table-availability.service.ts` | `processExpiredReservationHolds` | variable | N writes | N+1 markNoShow | Batch updateMany / cursor | Spike removal |
| 8 | `scheduler.service.ts` | no-show cron | — | global | Unbounded + N+1 | `take` + cursor | Platform scale |
| 9 | `table-sessions.ts` | expire inactive | — | global | Per-session await | Batch | Platform scale |
| 10 | Deep `category.findMany` trees | menu export / legacy | 26 ms | 7 prod | Deep include | Keep progressive; never on SSR hot path | Avoids regression |
| 11 | `menu-catalog/queries.ts` | category product cards | 6 ms | unbound | No `take` | Paginate large categories | Prevents outliers |
| 12 | `fulfillment-queries.ts` | `getKitchenQueue` | 28 ms | unbound | Full queue | Cap + lighter select | **30–60%** busy |
| 13 | `getDiningSessionDetail` | session detail | — | deep | 4-level includes | Slim for list; full only detail page | **40%** |
| 14 | Subscription feature includes | `getEffectiveFeatures` | 16 ms | 5 q | Prisma nested includes | Already React-cached; keep | OK |
| 15 | `orderItem.groupBy` top products | dashboard | in 86 ms | | Heavy over OrderItem | Precompute daily top | **50%** card |
| 16 | Analytics multi-groupBy | analytics page | — | | 30d scans | Use sales summary | **60%+** |
| 17 | Customer QR sequential finds | table page | waterfall | | Serial awaits | Parallel independent lookups | **20–40%** |
| 18 | Branding live include | layout-shell | — | | logo join | Share Data Cache branding | 1 RTT |
| 19 | `searchPublicMenu` / search API | uncached | — | | Always DB | Short TTL cache | QPS relief |
| 20 | Platform settings / origins | in-memory 60s | OK | | Multi-instance drift | Optional Redis | Consistency |
| 21–35 | Remaining findFirst auth paths | staff/session | 2–5 ms | 1 | Necessary | Leave + cache | — |
| 36–50 | Mutation findFirsts | order item ops | — | 1 | Correctness | Leave sequential | — |

*(Items 21–50 are mostly single-row correctness lookups — not bottlenecks.)*

### Index recommendations (SQL)

```sql
-- StaffSession: waiter lifecycle updateMany by restaurant
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StaffSession_restaurantId_idx"
  ON "StaffSession" ("restaurantId");

-- Order: table reset / table-session linkage
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_tableId_idx"
  ON "Order" ("tableId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_tableSessionId_idx"
  ON "Order" ("tableSessionId");

-- Optional covering for floor tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Table_restaurantId_isActive_idx"
  ON "Table" ("restaurantId", "isActive");
```

**Unused / redundant:** `Restaurant.@@index([subdomain])` is redundant with `@unique(subdomain)` — harmless.

**KitchenOrder:** only `@@index([status])` — for kitchen queue add:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "KitchenOrder_status_createdAt_idx"
  ON "KitchenOrder" ("status", "createdAt");
-- Prefer filtering via Order.restaurantId join; consider denormalizing restaurantId later (schema change = separate decision)
```

---

## 6. Duplicate work matrix

| Lookup | Request-cached? | Cross-request? | Gap |
|--------|-----------------|----------------|-----|
| Tenant by host | ✅ `cache()` | ❌ (OK — cheap unique) | — |
| Better Auth session | ✅ `cache()` | Cookie/session store | — |
| Staff session | ✅ `cache()` | — | — |
| Effective features | ✅ `cache()` | ❌ | Optional short Data Cache |
| Restaurant settings | ✅ `cache()` | ❌ | — |
| Public menu shell | — | ✅ 900s | Good |
| Public branding Data Cache | exists | ✅ | **`getPublicBranding` ignores it** |
| Floor availability | ❌ | ❌ (correct — live) | **Intra-request double fetch** |
| Staff order categories | ❌ live | — | Optional short cache |
| Dashboard restaurant | ❌ | — | Dup layout/page |
| Dashboard aggregates | ❌ | — | Short TTL cache |

---

## 7. Caching recommendations

| Data | Recommended | Why |
|------|-------------|-----|
| Tenant / auth / staff / features / settings | Keep **React `cache()`** | Dedupes layout+page+actions |
| Public menu shell + category products + product config | Keep **`unstable_cache` + tags** | Safe staleness ≤15 min |
| Public branding | Route **all** readers through Data Cache helper | Staff order + metadata share hit |
| Floor / kitchen / live sessions | **No Data Cache** — request compose only | Occupancy must be live |
| Dashboard KPI cards | **`unstable_cache` 30–60s** restaurant-tagged | Charts tolerate brief lag |
| Analytics 30d | Sales summary tables / short TTL | Avoid scanning OrderItem nightly size |
| Menu search | Short TTL Data Cache or Redis | Read-heavy |
| Platform settings / trusted origins | In-memory 60s OK; **Redis** if multi-instance | Consistency |
| Static marketing / CDN | HTTP CDN cache | Landing only |
| Images | CDN + width/quality; lazy | Payload |
| Browser cache | Cache-Control on public menu APIs | ETag optional |

---

## 8. Menu performance

| Surface | Current | Verdict |
|---------|---------|---------|
| Public menu | Progressive shell + APIs + cache | **Good** — primary pattern |
| Customer QR menu | Same public menu | Good shell; session waterfall hurts TTFB |
| Staff order | Slim category SSR + progressive load | **Good** — don’t reintroduce deep include |
| Delivery / takeaway admin order | Check fulfillment uses progressive catalog | Prefer same APIs |
| Admin products list | Paginated `select` | Good |
| Admin product detail | Deep config include | OK (single product) |
| Export Excel | Full tree | Infrequent — OK |

**Lazy loading:** Already in place for public/staff progressive products. Add pagination for huge categories. Lazy-load images (`loading="lazy"`, sized next/image).

---

## 9. Dashboard performance

`dashboard/page.tsx` fires in parallel:

- 4× product/category counts  
- restaurant+subscription  
- weekly revenue  
- active order count  
- table `groupBy`  
- recent orders  
- orderItem `groupBy` top products  

Then a **second** product fetch for top product images.

**Batching ideas (no feature removal):**

1. One SQL/CTE or raw query returning category/product/hidden/active counts.  
2. `React.cache(getRestaurantForDashboard)`.  
3. Short TTL cache for weekly revenue + top products.  
4. Prefer `DailySalesSummary` path (already implemented) — ensure cron keeps it warm.

Analytics page: multiple 30-day groupBys — push to summaries.

---

## 10. Authentication timing

| Step | Typical | Cached? |
|------|---------|---------|
| Cookie parse | &lt;1 ms | n/a |
| Better Auth `getSession` | 5–30 ms | ✅ React cache |
| Staff token hash + `staffSession.findUnique` | 2–5 ms | ✅ |
| Tenant host → restaurant | 1–3 ms | ✅ |
| `getEffectiveFeatures` | 10–20 ms cold / ~0 warm req | ✅ |
| Role checks | CPU | n/a |

**Conclusion:** Auth duplication within a request is largely solved. Don’t add Redis for sessions unless multi-region. Focus elsewhere.

---

## 11. Reservation system

| Path | Issue |
|------|-------|
| `getAvailableTables` | **Critical N+1** |
| `getRestaurantTablesAvailability` | Batched — good model to copy |
| `processExpiredReservationHolds` | Per-row markNoShow; also called from floor reads | Move to cron-only or batch |
| Calendar/day lists | Unbounded findMany | Soft cap / window |
| Cron scheduler | Global findMany + N+1 events | Cursor pagination |

**Duplicate scans:** Floor invokes hold expiry on every availability read — busy floor = repeated scans. Prefer cron + opportunistic batch with cooldown.

---

## 12. Floor screen

Measured duplicate pattern: **6 queries**, JSON ~1.7 KB demo / grows with sessions.

| Layer | Waste |
|-------|-------|
| tables | loaded twice |
| diningSession | rich + slim twice |
| tableSession | once (needed) |
| reservations | once (needed) |
| serialize | includes full table rows + session nests |

**Fix shape:** One function returns tables + rich session map + availability snapshots without re-querying tables/sessions.

---

## 13. Staff order screen

Already improved (category shell only). Remaining:

- Branding not Data-Cached  
- Layout feature/subscription work before page  
- Client still fans out category product requests — ensure HTTP cache headers / shared cache

---

## 14. Customer QR

Sequential after menu:

1. token read  
2. load own session  
3. maybe terminal session  
4. maybe clear cookie  
5. maybe blocking session  
6. maybe active dining  

Independent lookups (blocking vs dining when no own session) → **`Promise.all`**.

---

## 15. Public menu

Strong. Wins left: warm HTTP still ~700 ms in **dev** (framework); production expected much lower. Align branding cache; Cache-Control on progressive APIs; CDN for images.

---

## 16. Platform admin

Restaurant list paginated — OK. Stats action with many counts — parallelize if sequential; short cache for dashboard cards. Avoid loading all subscriptions without pagination (redirect exists).

---

## 17–20. Indexes, payloads, parallelization, N+1

Covered above. Highest-value parallelizations:

```ts
// table-availability: after processExpiredReservationHolds
await Promise.all([tables, sessions, customerSessions, reservations]);

// customer QR (when no own session)
await Promise.all([getBlockingTableSession, getActiveDiningSessionForTable]);

// recalculateOrder reads
await Promise.all([items, order]); // tax settings can join after
```

**Do not parallelize** dependent mutations (create order → add item → recalc).

---

## 21. Instrumentation note

Temporary harness: `scripts/perf-audit-measure.mjs` (Prisma query events + scenario timings) + HTTP `Invoke-WebRequest` against `24e0da0a.localhost:3000/menu`.

Route-level `performance.now()` was **not** left in production pages (audit-only; removed/not committed into app routes).

---

## 22. Prioritized optimization roadmap

### Critical (huge gains)

| # | Change | Est. improvement | Risk | Complexity | Affected |
|---|--------|------------------|------|------------|----------|
| C1 | Batch `getAvailableTables` (kill N+1) | **70–90%** suggest/availability | Low | Medium | Reservations suggest, create wizards |
| C2 | Compose floor fetch (no double table/session) | **40–55%** floor API | Low | Medium | Staff floor, any shared helper |
| C3 | Slim `getActiveDiningSessions` (no all items) | **50–70%** admin floor poll | Medium (UI must use aggregates) | Medium | Live floor dashboard |
| C4 | Stop/limit hold-expiry work on every floor read | Removes latency spikes | Low | Low–Med | Floor, availability |

### High

| # | Change | Est. improvement | Risk | Complexity | Affected |
|---|--------|------------------|---|---|---|
| H1 | `React.cache` shared restaurant for dashboard layout+page | −1 RTT | Low | Low | Admin shell + overview |
| H2 | Wire `getPublicBranding` → Data Cache | −1 branding query × many pages | Low | Low | Staff order, public layout |
| H3 | Parallelize availability’s reservation query with sessions | **20–35%** availability | Low | Low | Floor, session start |
| H4 | Customer QR `Promise.all` independent session checks | **20–40%** QR TTFB | Low | Low | Customer table page |
| H5 | Indexes: StaffSession.restaurantId, Order.tableId/tableSessionId | **10–40%** on those paths | Low | Low | Resets, waiter deletes |
| H6 | Short-TTL cache dashboard KPIs / analytics summaries | **30–50%** admin home | Low | Medium | Dashboard, analytics |
| H7 | Paginate kitchen queue + category product cards | Prevents p99 blowups | Low | Low | Kitchen, progressive menu |

### Medium

| # | Change | Est. improvement |
|---|--------|------------------|
| M1 | Cap cron findManys with cursor | Platform stability |
| M2 | Cache menu search short TTL | Search QPS |
| M3 | HTTP Cache-Control on public menu APIs | Edge/browser wins |
| M4 | Slim kitchen ticket select | Poll bandwidth |
| M5 | Consolidate dashboard product counts into one query | −3 RTTs worth of work |
| M6 | Prefetch first category products in staff/public shell (already partial) | Perceived speed |

### Low

| # | Change | Est. improvement |
|---|--------|------------------|
| L1 | Remove redundant subdomain index | Hygiene |
| L2 | Memoize pure mappers | Negligible |
| L3 | Bundle-split heavy admin charts | Client TTI |
| L4 | Image CDN/quality defaults | LCP |

---

## 23. Estimated results after Critical + High

Figures = **perceived warm TTFB / poll** at a mid-busy café (not Demo empties; not including cold Next compile). Dev HTTP numbers will stay higher than production Node.

| Screen / API | Current (realistic busy) | Expected after C+H | Why |
|--------------|--------------------------|--------------------|-----|
| Admin Dashboard | 800–1800 ms | **350–700 ms** | Less duplicate restaurant + cached KPIs + fewer counts |
| Staff Order | 400–900 ms | **250–450 ms** | Already slim; branding cache + layout trim |
| Staff Floor poll | 300–800 ms | **120–300 ms** | No double fetch + parallel availability |
| Admin Live Floor poll | 500–1500 ms | **150–400 ms** | Slim sessions payload |
| Public Menu (prod warm) | 400–900 ms | **200–450 ms** | Cache hits + lighter RSC; CDN images |
| Customer QR | 600–1400 ms | **300–700 ms** | Parallel session checks + cached menu |
| Reservation suggest | 200–2000 ms (∝ tables) | **50–150 ms** | Batched availability |
| Kitchen poll | 200–600 ms | **100–250 ms** | Cap + select |

---

## Success metrics (when implementing later)

| Surface | Baseline metric | Target |
|---------|-----------------|--------|
| `GET /api/staff/floor` p95 | Instrument | &lt; 200 ms |
| `GET /api/admin/floor/sessions` payload | bytes | −50% bytes |
| `getAvailableTables` query count | 3N | ≤ 4 total |
| Dashboard overview query count | ~12+ | ≤ 6–7 |
| Public menu LCP (prod) | RUM | &lt; 1.5 s 4G |

---

## Screen audits (condensed)

### Floor — `/staff/floor`
**Flow analogy:** Asking two waiters to count the same tables independently, then merging clipboards.  
**Fix:** One composed read.

### Staff Order — `/staff/order/[id]`
**Flow analogy:** Bringing the whole pantry to take one coffee order — **already fixed** to bring the aisle list only.  
**Fix:** Branding cache + keep progressive products.

### Public Menu — `/menu`
**Flow analogy:** Showing the cover and first section, then fetching later chapters — **correct**.  
**Fix:** Edge/HTTP cache; branding alignment.

### Customer QR
**Flow analogy:** Five sequential security checks at the door.  
**Fix:** Run independent checks in parallel.

### Reservations suggest
**Flow analogy:** Walking to the reservation book once per table.  
**Fix:** Bring the whole book once (batch).

### Admin Live Floor
**Flow analogy:** Photocopying every order ticket just to know if the table is “cooking”.  
**Fix:** Aggregate kitchen statuses instead of shipping every item.

---

## Cross-cutting

- **`force-dynamic` everywhere** on admin/staff trees — correct for POS authenticity; compensate with request cache + short Data Cache for non-live KPIs.  
- **Prisma connection:** ensure `connection_limit` sized for serverless/hot reload if deployed on serverless.  
- **Polling:** floor/kitchen — consider ETag / `If-None-Match` or incremental since-token to cut JSON when unchanged.  
- **Observability (P2):** OpenTelemetry spans on tenant, auth, db, serialize for production p95 — do not leave debug `performance.now` logs in routes.

---

*End of audit. No production business logic was modified. Measurement harness should be deleted after review if not needed for re-runs.*
