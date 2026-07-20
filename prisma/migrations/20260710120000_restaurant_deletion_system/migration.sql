-- Restaurant deletion system: metadata, archive tables, enum extensions

-- ActivityAction
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'RESTORE';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PERMANENT_DELETE';

-- BillingAuditAction
ALTER TYPE "BillingAuditAction" ADD VALUE IF NOT EXISTS 'RESTAURANT_DELETED';
ALTER TYPE "BillingAuditAction" ADD VALUE IF NOT EXISTS 'RESTAURANT_RESTORED';
ALTER TYPE "BillingAuditAction" ADD VALUE IF NOT EXISTS 'RESTAURANT_PERMANENTLY_DELETED';
ALTER TYPE "BillingAuditAction" ADD VALUE IF NOT EXISTS 'SUBDOMAIN_DISABLED';
ALTER TYPE "BillingAuditAction" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CANCELLED';

-- BillingRecordType
CREATE TYPE "BillingRecordType" AS ENUM ('SUBSCRIPTION', 'INVOICE', 'PAYMENT', 'SUBSCRIPTION_EVENT');

-- Restaurant soft-delete metadata
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "deleteReason" TEXT;

ALTER TABLE "Restaurant" DROP CONSTRAINT IF EXISTS "Restaurant_deletedBy_fkey";
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_deletedBy_fkey"
  FOREIGN KEY ("deletedBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Subscription cancellation metadata
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_cancelledByUserId_fkey";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_cancelledByUserId_fkey"
  FOREIGN KEY ("cancelledByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restaurant archive
CREATE TABLE IF NOT EXISTS "RestaurantArchive" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "subdomain" TEXT NOT NULL,
  "permanentlyDeletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "permanentlyDeletedBy" TEXT,
  "deleteReason" TEXT,
  "softDeletedAt" TIMESTAMP(3),
  "softDeletedBy" TEXT,
  "subscriptionStatusAtDeletion" TEXT,
  "razorpaySubscriptionId" TEXT,
  "orderCount" INTEGER NOT NULL DEFAULT 0,
  "customerCount" INTEGER NOT NULL DEFAULT 0,
  "reservationCount" INTEGER NOT NULL DEFAULT 0,
  "staffCount" INTEGER NOT NULL DEFAULT 0,
  "menuItemCount" INTEGER NOT NULL DEFAULT 0,
  "invoiceCount" INTEGER NOT NULL DEFAULT 0,
  "paymentCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RestaurantArchive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RestaurantArchive_permanentlyDeletedAt_idx" ON "RestaurantArchive"("permanentlyDeletedAt");
CREATE INDEX IF NOT EXISTS "RestaurantArchive_subdomain_idx" ON "RestaurantArchive"("subdomain");

ALTER TABLE "RestaurantArchive" DROP CONSTRAINT IF EXISTS "RestaurantArchive_permanentlyDeletedBy_fkey";
ALTER TABLE "RestaurantArchive" ADD CONSTRAINT "RestaurantArchive_permanentlyDeletedBy_fkey"
  FOREIGN KEY ("permanentlyDeletedBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RestaurantArchive" DROP CONSTRAINT IF EXISTS "RestaurantArchive_softDeletedBy_fkey";
ALTER TABLE "RestaurantArchive" ADD CONSTRAINT "RestaurantArchive_softDeletedBy_fkey"
  FOREIGN KEY ("softDeletedBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Billing record archive
CREATE TABLE IF NOT EXISTS "BillingRecord" (
  "id" TEXT NOT NULL,
  "restaurantArchiveId" TEXT NOT NULL,
  "recordType" "BillingRecordType" NOT NULL,
  "restaurantNameSnapshot" TEXT NOT NULL,
  "restaurantSubdomainSnapshot" TEXT NOT NULL,
  "sourceId" TEXT,
  "amount" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT,
  "invoiceNumber" TEXT,
  "razorpayPaymentId" TEXT,
  "razorpayInvoiceId" TEXT,
  "razorpaySubscriptionId" TEXT,
  "paidAt" TIMESTAMP(3),
  "billingPeriodStart" TIMESTAMP(3),
  "billingPeriodEnd" TIMESTAMP(3),
  "rawPayload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BillingRecord_restaurantArchiveId_idx" ON "BillingRecord"("restaurantArchiveId");
CREATE INDEX IF NOT EXISTS "BillingRecord_recordType_idx" ON "BillingRecord"("recordType");
CREATE INDEX IF NOT EXISTS "BillingRecord_sourceId_idx" ON "BillingRecord"("sourceId");

ALTER TABLE "BillingRecord" DROP CONSTRAINT IF EXISTS "BillingRecord_restaurantArchiveId_fkey";
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_restaurantArchiveId_fkey"
  FOREIGN KEY ("restaurantArchiveId") REFERENCES "RestaurantArchive"("id") ON DELETE CASCADE ON UPDATE CASCADE;
