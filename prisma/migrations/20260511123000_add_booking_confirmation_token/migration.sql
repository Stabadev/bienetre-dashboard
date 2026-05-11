-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN "confirmationTokenHash" TEXT,
ADD COLUMN "confirmationTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_confirmationTokenHash_key" ON "Booking"("confirmationTokenHash");

-- CreateIndex
CREATE INDEX "Booking_confirmationTokenExpiresAt_idx" ON "Booking"("confirmationTokenExpiresAt");
