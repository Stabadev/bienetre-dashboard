-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN "externalEventUri" TEXT,
ADD COLUMN "externalInviteeUri" TEXT,
ADD COLUMN "externalEventTypeUri" TEXT,
ADD COLUMN "externalStatus" TEXT,
ADD COLUMN "externalUpdatedAt" TIMESTAMP(3),
ADD COLUMN "syncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_source_externalEventUri_key" ON "Booking"("source", "externalEventUri");
