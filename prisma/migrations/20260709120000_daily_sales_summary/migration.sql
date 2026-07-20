-- CreateTable
CREATE TABLE "daily_sales_summary" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "revenueTotal" INTEGER NOT NULL DEFAULT 0,
    "itemQuantity" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_sales_summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_sales_summary_restaurantId_day_orderType_key" ON "daily_sales_summary"("restaurantId", "day", "orderType");

-- CreateIndex
CREATE INDEX "daily_sales_summary_restaurantId_day_idx" ON "daily_sales_summary"("restaurantId", "day");

-- AddForeignKey
ALTER TABLE "daily_sales_summary" ADD CONSTRAINT "daily_sales_summary_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
