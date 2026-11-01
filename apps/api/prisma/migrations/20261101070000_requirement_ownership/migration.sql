ALTER TABLE "BrokerRequirement" ADD COLUMN "createdById" TEXT, ADD COLUMN "assignedToId" TEXT;

-- Retain known ownership only. Unowned historical records stay visible to firm administrators.
UPDATE "BrokerRequirement" r SET "assignedToId" = l."assignedToId"
FROM "Lead" l WHERE r."leadId" = l.id AND r."organizationId" = l."organizationId";
UPDATE "BrokerRequirement" r SET "createdById" = b."createdById"
FROM "SourceEntry" s JOIN "ImportBatch" b ON b.id = s."batchId"
WHERE r."sourceEntryId" = s.id AND r."organizationId" = b."organizationId";

CREATE INDEX "BrokerRequirement_organizationId_assignedToId_idx" ON "BrokerRequirement"("organizationId", "assignedToId");
CREATE INDEX "BrokerRequirement_organizationId_createdById_idx" ON "BrokerRequirement"("organizationId", "createdById");
