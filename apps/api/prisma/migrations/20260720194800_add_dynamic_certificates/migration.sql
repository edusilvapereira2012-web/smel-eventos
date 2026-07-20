-- DropIndex
DROP INDEX IF EXISTS "Certificate_registrationId_key";

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "customTitle" TEXT,
ADD COLUMN     "hours" INTEGER,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'EVENT',
ADD COLUMN     "workshopId" TEXT;

-- CreateIndex
CREATE INDEX "Certificate_registrationId_type_workshopId_idx" ON "Certificate"("registrationId", "type", "workshopId");

-- CreateIndex
CREATE INDEX "Certificate_eventId_idx" ON "Certificate"("eventId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
