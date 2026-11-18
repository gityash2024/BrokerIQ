ALTER TABLE "ImportUpload" ADD COLUMN "registerSessionId" TEXT, ADD COLUMN "registerPageNo" INTEGER, ADD COLUMN "registerSector" TEXT;
CREATE UNIQUE INDEX "ImportUpload_register_page_key" ON "ImportUpload"("organizationId", "createdById", "registerSessionId", "registerPageNo");
