/*
  Warnings:

  - You are about to drop the column `teacher_id` on the `enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `completed` on the `watch_history` table. All the data in the column will be lost.
  - You are about to drop the column `current_time` on the `watch_history` table. All the data in the column will be lost.
  - You are about to drop the column `total_duration` on the `watch_history` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_teacher_id_fkey";

-- AlterTable
ALTER TABLE "enrollments" DROP COLUMN "teacher_id";

-- AlterTable
ALTER TABLE "watch_history" DROP COLUMN "completed",
DROP COLUMN "current_time",
DROP COLUMN "total_duration";
