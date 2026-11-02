-- Additive: existing installed clients retain normal creation; NULL submission keys do not collide.
ALTER TABLE "FollowUp" ADD COLUMN "clientMutationId" TEXT, ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "FollowUp_organizationId_clientMutationId_key" ON "FollowUp"("organizationId", "clientMutationId");
