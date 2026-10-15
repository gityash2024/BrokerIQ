-- AlterTable
ALTER TABLE "SourceEntry" ADD COLUMN     "duplicateOfId" TEXT,
ADD COLUMN     "messageIdentity" TEXT,
ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SourceEntry_organizationId_messageIdentity_key" ON "SourceEntry"("organizationId", "messageIdentity");
