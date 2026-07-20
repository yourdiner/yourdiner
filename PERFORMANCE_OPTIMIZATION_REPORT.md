# Performance Optimization Report

**Date:** 2026-07-14  
**Constraint:** Behaviour-preserving only (no auth, pricing, reservation-rule, UI, or API contract changes).

---

## Optimizations implemented

### 1. Reservation suggest — kill N+1

| | |
|--|--|
| **Files** | [`src/features/reservations/availability.service.ts`](src/features/reservations/availability.service.ts) |
| **Why slow** | `getAvailableTables` called `isTableAvailable` per table (~3 queries each) |
| **New** | One tables query + parallel sessions + reservations; `filterReservationConflicts` in memory |
| **Measured** | Demo Cafe 5 tables: **15 → 3 queries**, **31 ms → 8 ms** (~**3.3×**) |
| **Est. @40 tables** | **~70–90%** fewer queries / wall time |

### 2. Floor API — compose once

| | |
|--|--|
| **Files** | [`src/features/floor/queries.ts`](src/features/floor/queries.ts), [`src/features/tables/table-availability.service.ts`](src/features/tables/table-availability.service.ts), [`src/features/tables/table-availability.builder.ts`](src/features/tables/table-availability.builder.ts) |
| **Why slow** | `fetchFloorTablesForRestaurant` loaded tables/sessions, then `getRestaurantTablesAvailability` loaded them again |
| **New** | Single `Promise.all` of tables + rich sessions + customer sessions + reservations → `buildAvailabilityMap` |
| **Measured** | **6 → 4 queries** for equivalent data load |
| **Est. gain** | **~40–55%** floor poll DB work at scale |

### 3. Hold expiry off availability hot path

| | |
|--|--|
| **Files** | [`table-availability.service.ts`](src/features/tables/table-availability.service.ts) |
| **Why slow** | Every availability/floor read awaited `processExpiredReservationHolds` (settings + findMany + N× `markNoShow`) |
| **New** | Removed from `getTableAvailability` / `getRestaurantTablesAvailability`. Classification already ignores expired holds via `holdExpiresAt`. Cron + reservations dashboard still write `NO_SHOW`. |
| **Est. gain** | Removes latency spikes on busy floors |

### 4. Admin live floor — drop unused order items

| | |
|--|--|
| **Files** | [`session.service.ts`](src/features/dining-session/session.service.ts) `getActiveDiningSessions` |
| **Why slow** | Selected every open order’s `items.kitchenStatus` though API/UI only use `orders[].total` / length |
| **New** | Select `id`, `total`, `status` only |
| **Payload** | Serialized API shape unchanged `{ total, status }[]` |
| **Est. gain** | **~50–70%** less nested row weight under load |

### 5. Dashboard — shared restaurant + merged counts

| | |
|--|--|
| **Files** | [`request-cache.ts`](src/lib/request-cache.ts), [`layout-shell.tsx`](src/app/dashboard/layout-shell.tsx), [`dashboard/page.tsx`](src/app/dashboard/page.tsx) |
| **Why slow** | Layout + page each loaded restaurant+subscription; four separate product/category `count()`s |
| **New** | `getRestaurantWithSubscriptionCached`; `getDashboardMenuCounts` via `groupBy` + one category count |
| **Est. gain** | **−1 restaurant RTT**; **4 counts → 2 queries** for menu cards |

### 6. Branding Data Cache

| | |
|--|--|
| **Files** | [`branding/actions.ts`](src/features/branding/actions.ts), branding API routes |
| **Why slow** | Public/staff paths used request-only DB branding; API PATCH/image skipped tag revalidation |
| **New** | `getPublicBranding` → `getCachedPublicBranding` (`unstable_cache` 900s); API routes call `revalidatePublicMenuCache` |
| **Admin** | `getBranding()` still request-cached fresh for editors |

### 7. Customer QR parallelization

| | |
|--|--|
| **Files** | [`customer/table/[tableSlug]/page.tsx`](src/app/customer/table/[tableSlug]/page.tsx) |
| **Why slow** | Sequential menu → feature → token → sessions |
| **New** | `Promise.all` for menu + ordering flag + token; `Promise.all` for blocking session + dining when not own table |
| **Est. gain** | **~20–40%** TTFB on QR entry |

### 8. Indexes

| Index | Model |
|-------|--------|
| `StaffSession_restaurantId_idx` | StaffSession |
| `Order_tableId_idx` | Order |
| `Order_tableSessionId_idx` | Order |

Applied via `prisma db push` (schema updated).

---

## Query improvements (summary)

| Path | Old | New | Reduction |
|------|-----|-----|-----------|
| Floor compose | 6 (+ hold writes) | 4 | ~33% queries + no hold writes |
| Suggest tables (5) | 15 | 3 | **80%** |
| Dashboard menu counts | 4 | 2 | **50%** |
| Dashboard restaurant | 2× | 1× (request cache) | 1 RTT |
| Live floor orders | include items | no items | payload shrink |

---

## Payload improvements

| Surface | Change |
|---------|--------|
| `/api/admin/floor/sessions` | Same JSON fields; less DB weight (no items rows) |
| `/api/staff/floor` | Identical overlays/keys; fewer internal queries |

---

## Cache improvements

| Data | Mechanism |
|------|-----------|
| Public branding | `unstable_cache` + `public-branding-*` tag |
| Branding invalidation | Server actions **and** PATCH/image APIs |
| Dashboard restaurant | `React.cache` shared layout/page |
| Dashboard menu counts | `React.cache` per request |

---

## Indexes added

1. `StaffSession(restaurantId)`  
2. `Order(tableId)`  
3. `Order(tableSessionId)`  

---

## Tests

- `table-availability.builder.test.ts` — 5 new cases (map + conflict filter)  
- `table-availability.logic.test.ts` — pass  
- `table-availability.integration.test.ts` — 6 pass  

Temporary validation script was run then deleted (no production instrumentation left).

---

## Remaining bottlenecks (not changed — would alter behaviour or require larger projects)

| Item | Why skipped |
|------|-------------|
| Kitchen queue pagination | Would truncate currently unbounded list |
| Category product card `take` | Completeness change for huge categories |
| HTTP Cache-Control on APIs | Freshness / multi-tenant edge semantics |
| Redis for sessions/features | Infra + staleness risk |
| Denormalize `KitchenOrder.restaurantId` | Schema beyond additive indexes |
| Reservation conflict window math | Forbidden business-rule change |

---

## Expected user-visible latency (busy café, after this pass)

| Surface | Direction |
|---------|-----------|
| Staff floor poll | Noticeably cheaper (no double load / no hold flush) |
| Reservation suggest | Large win as table count grows |
| Admin live floor poll | Lighter under many open items |
| Admin overview | Fewer round-trips |
| Public branding / staff order shell | Cross-request branding cache hits |
| Customer QR open | Fewer sequential waits |
