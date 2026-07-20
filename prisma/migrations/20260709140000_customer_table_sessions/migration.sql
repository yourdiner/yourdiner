-- CreateEnum
CREATE TYPE "TableSessionStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'EXPIRED', 'CLOSED');
CREATE TYPE "DiningSessionSource" AS ENUM ('STAFF', 'CUSTOMER_QR');

-- AlterEnum DiningSessionEventType
ALTER TYPE "DiningSessionEventType" ADD VALUE IF NOT EXISTS 'SESSION_PENDING_APPROVAL';
ALTER TYPE "DiningSessionEventType" ADD VALUE IF NOT EXISTS 'SESSION_APPROVED';
ALTER TYPE "DiningSessionEventType" ADD VALUE IF NOT EXISTS 'SESSION_REJECTED';
ALTER TYPE "DiningSessionEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_ORDER_PENDING_APPROVAL';
ALTER TYPE "DiningSessionEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_ORDER_APPROVED';
ALTER TYPE "DiningSessionEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_ORDER_REJECTED';

-- Table.qrSlug
ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS "qrSlug" TEXT;
UPDATE "Table" SET "qrSlug" = 'T' || "number"::text WHERE "qrSlug" IS NULL;
ALTER TABLE "Table" ALTER COLUMN "qrSlug" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Table_restaurantId_qrSlug_key" ON "Table"("restaurantId", "qrSlug");

-- Order.awaitingCustomerOrderApproval
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "awaitingCustomerOrderApproval" BOOLEAN NOT NULL DEFAULT false;

-- DiningSession.source
ALTER TABLE "DiningSession" ADD COLUMN IF NOT EXISTS "source" "DiningSessionSource" NOT NULL DEFAULT 'STAFF';

-- TableSession repurpose
ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "diningSessionId" TEXT;
ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "sessionToken" TEXT;
ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "status" "TableSessionStatus" NOT NULL DEFAULT 'CLOSED';
ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "firstOrderApprovedAt" TIMESTAMP(3);

UPDATE "TableSession" SET "sessionToken" = "token" WHERE "sessionToken" IS NULL;
UPDATE "TableSession" SET "status" = 'CLOSED', "endedAt" = COALESCE("endedAt", NOW()) WHERE "status" = 'CLOSED' AND "isActive" = false;
UPDATE "TableSession" SET "status" = 'CLOSED', "endedAt" = NOW(), "isActive" = false WHERE "isActive" = true;

ALTER TABLE "TableSession" ALTER COLUMN "sessionToken" SET NOT NULL;
ALTER TABLE "TableSession" ALTER COLUMN "expiresAt" DROP NOT NULL;

DROP INDEX IF EXISTS "TableSession_token_idx";
DROP INDEX IF EXISTS "TableSession_tableId_isActive_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "TableSession_sessionToken_key" ON "TableSession"("sessionToken");
CREATE UNIQUE INDEX IF NOT EXISTS "TableSession_diningSessionId_key" ON "TableSession"("diningSessionId");
CREATE INDEX IF NOT EXISTS "TableSession_tableId_status_idx" ON "TableSession"("tableId", "status");
CREATE INDEX IF NOT EXISTS "TableSession_restaurantId_status_idx" ON "TableSession"("restaurantId", "status");

ALTER TABLE "TableSession" DROP COLUMN IF EXISTS "token";

ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_diningSessionId_fkey" FOREIGN KEY ("diningSessionId") REFERENCES "DiningSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
