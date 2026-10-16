-- Existing sessions stay valid at version zero. Recovery increments the user
-- version; old access tokens and in-flight refresh descendants then fail closed.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RefreshToken" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
