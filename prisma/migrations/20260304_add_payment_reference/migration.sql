-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "paymentReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_paymentReference_key" ON "Booking"("paymentReference");

-- CreateIndex
CREATE INDEX "Booking_paymentReference_idx" ON "Booking"("paymentReference");
