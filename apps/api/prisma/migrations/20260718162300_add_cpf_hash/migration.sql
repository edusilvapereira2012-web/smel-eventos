-- AlterTable
ALTER TABLE "Registration" ADD COLUMN "cpfHash" TEXT;

-- CreateIndex
CREATE INDEX "Registration_cpfHash_eventId_idx" ON "Registration"("cpfHash", "eventId");
