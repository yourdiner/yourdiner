-- AlterTable
ALTER TABLE "TableSession" ADD COLUMN "reservationId" TEXT;

-- CreateIndex
CREATE INDEX "TableSession_reservationId_idx" ON "TableSession"("reservationId");

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
