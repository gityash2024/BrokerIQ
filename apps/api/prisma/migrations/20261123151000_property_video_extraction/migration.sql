CREATE TABLE "PropertyVideoExtraction" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "organizationId" text,
  "sourceKey" text NOT NULL UNIQUE,
  "state" text NOT NULL DEFAULT 'AWAITING_UPLOAD',
  "frameKeys" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "urls" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "aiVerified" boolean NOT NULL DEFAULT false,
  "expiresAt" timestamp(3) NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PropertyVideoExtraction_expiresAt_idx" ON "PropertyVideoExtraction" ("expiresAt");
CREATE INDEX "PropertyVideoExtraction_userId_expiresAt_idx" ON "PropertyVideoExtraction" ("userId", "expiresAt");
