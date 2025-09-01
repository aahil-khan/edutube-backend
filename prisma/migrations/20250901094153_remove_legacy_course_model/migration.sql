/*
  Warnings:

  - You are about to drop the column `course_id` on the `chapters` table. All the data in the column will be lost.
  - You are about to drop the column `course_id` on the `enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `course_id` on the `lectures` table. All the data in the column will be lost.
  - You are about to drop the `courses` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `course_instance_id` on table `chapters` required. This step will fail if there are existing NULL values in that column.
  - Made the column `course_instance_id` on table `enrollments` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "chapters" DROP CONSTRAINT "chapters_course_id_fkey";

-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_teacher_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_course_id_fkey";

-- DropForeignKey
ALTER TABLE "lectures" DROP CONSTRAINT "lectures_course_id_fkey";

-- DropIndex
DROP INDEX "chapters_course_id_number_key";

-- DropIndex
DROP INDEX "enrollments_student_id_course_id_key";

-- AlterTable
ALTER TABLE "chapters" DROP COLUMN "course_id",
ALTER COLUMN "course_instance_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "enrollments" DROP COLUMN "course_id",
ALTER COLUMN "course_instance_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "lectures" DROP COLUMN "course_id";

-- DropTable
DROP TABLE "courses";
