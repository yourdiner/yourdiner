-- Performance indexes from DB audit (no business-logic changes)

CREATE INDEX IF NOT EXISTS "Order_restaurantId_status_createdAt_idx"
  ON "Order" ("restaurantId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "TableSession_restaurantId_status_isActive_createdAt_idx"
  ON "TableSession" ("restaurantId", "status", "isActive", "createdAt");

CREATE INDEX IF NOT EXISTS "DiningSession_restaurantId_status_startedAt_idx"
  ON "DiningSession" ("restaurantId", "status", "startedAt");

CREATE INDEX IF NOT EXISTS "DiningSession_restaurantId_status_closedAt_idx"
  ON "DiningSession" ("restaurantId", "status", "closedAt");

CREATE INDEX IF NOT EXISTS "Customer_restaurantId_totalSpend_idx"
  ON "Customer" ("restaurantId", "totalSpend");

CREATE INDEX IF NOT EXISTS "Notification_restaurantId_isRead_createdAt_idx"
  ON "Notification" ("restaurantId", "isRead", "createdAt");
