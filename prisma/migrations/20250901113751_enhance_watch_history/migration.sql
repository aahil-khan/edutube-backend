-- AlterTable
ALTER TABLE "watch_history" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "current_time" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_duration" INTEGER NOT NULL DEFAULT 0;
