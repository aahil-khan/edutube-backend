-- Idempotent: seed/restored DBs may already contain these objects (same names as Prisma schema).

-- AlterTable
ALTER TABLE "lectures" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE "lectures" ADD COLUMN IF NOT EXISTS "youtube_video_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "lectures_youtube_video_id_key" ON "lectures"("youtube_video_id");

-- CreateTable
CREATE TABLE IF NOT EXISTS "cli_api_keys" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" INTEGER,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "cli_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cli_api_keys_key_prefix_key" ON "cli_api_keys"("key_prefix");

DO $$
BEGIN
    ALTER TABLE "cli_api_keys"
        ADD CONSTRAINT "cli_api_keys_created_by_user_id_fkey"
        FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
