-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "calendlyEventUri" TEXT,
ADD COLUMN "calendlyInviteeUri" TEXT,
ADD COLUMN "clientFirstName" TEXT,
ADD COLUMN "clientLastName" TEXT,
ADD COLUMN "clientEmail" TEXT,
ADD COLUMN "clientPhone" TEXT;
