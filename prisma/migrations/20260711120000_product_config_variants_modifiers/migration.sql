-- ProductVariantGroup + extended snapshots for order items

CREATE TABLE IF NOT EXISTS "ProductVariantGroup" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariantGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductVariantGroup_productId_idx" ON "ProductVariantGroup"("productId");

DO $$ BEGIN
  ALTER TABLE "ProductVariantGroup" ADD CONSTRAINT "ProductVariantGroup_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "prepTimeMinutes" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "branchPricing" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "ProductVariant_groupId_idx" ON "ProductVariant"("groupId");

DO $$ BEGIN
  ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "ProductVariantGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Modifier" ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Modifier" ADD COLUMN IF NOT EXISTS "branchPricing" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "variantNameSnapshot" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "variantPriceSnapshot" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "basePriceSnapshot" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "configurationKey" TEXT;

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_configurationKey_idx" ON "OrderItem"("orderId", "configurationKey");

-- Backfill default variant group for products with existing variants
INSERT INTO "ProductVariantGroup" ("id", "productId", "name", "isRequired", "sortOrder")
SELECT
    'pvg_' || substr(md5(p."id" || ':options'), 1, 24),
    p."id",
    'Options',
    true,
    0
FROM "Product" p
WHERE EXISTS (SELECT 1 FROM "ProductVariant" pv WHERE pv."productId" = p."id")
ON CONFLICT DO NOTHING;

UPDATE "ProductVariant" pv
SET "groupId" = pvg."id"
FROM "ProductVariantGroup" pvg
WHERE pv."productId" = pvg."productId"
  AND pv."groupId" IS NULL
  AND pvg."name" = 'Options';

UPDATE "OrderItem"
SET "basePriceSnapshot" = "unitPrice"
WHERE "basePriceSnapshot" = 0;
