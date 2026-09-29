-- Run once against the production database before deploying the new server.
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "contentSnapshot" JSONB;
