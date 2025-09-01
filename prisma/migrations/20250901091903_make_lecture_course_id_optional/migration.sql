/*
  Warnings:

  - You are about to drop the column `chapter_name` on the `lectures` table. All the data in the column will be lost.
  - You are about to drop the column `chapter_number` on the `lectures` table. All the data in the column will be lost.
  - You are about to drop the column `teacher_id` on the `lectures` table. All the data in the column will be lost.
  - You are about to drop the column `course_id` on the `teachers` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[student_id,course_id]` on the table `enrollments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[student_id,course_instance_id]` on the table `enrollments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[chapter_id,lecture_number]` on the table `lectures` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id]` on the table `teachers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `teacher_id` to the `courses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chapter_id` to the `lectures` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "lectures" DROP CONSTRAINT "lectures_teacher_id_fkey";

-- DropForeignKey
ALTER TABLE "teachers" DROP CONSTRAINT "teachers_course_id_fkey";

-- DropIndex
DROP INDEX "enrollments_student_id_teacher_id_key";

-- DropIndex
DROP INDEX "teachers_user_id_course_id_key";

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "teacher_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "course_id" INTEGER,
ADD COLUMN     "course_instance_id" INTEGER;

-- AlterTable
ALTER TABLE "lectures" DROP COLUMN "chapter_name",
DROP COLUMN "chapter_number",
DROP COLUMN "teacher_id",
ADD COLUMN     "chapter_id" INTEGER NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "duration" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "course_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "teachers" DROP COLUMN "course_id";

-- CreateTable
CREATE TABLE "course_templates" (
    "id" SERIAL NOT NULL,
    "course_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_instances" (
    "id" SERIAL NOT NULL,
    "course_template_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "instance_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER,
    "course_instance_id" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecture_tags" (
    "id" SERIAL NOT NULL,
    "lecture_id" INTEGER NOT NULL,
    "tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecture_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_templates_course_code_key" ON "course_templates"("course_code");

-- CreateIndex
CREATE UNIQUE INDEX "course_instances_course_template_id_teacher_id_key" ON "course_instances"("course_template_id", "teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_course_id_number_key" ON "chapters"("course_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_course_instance_id_number_key" ON "chapters"("course_instance_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "lecture_tags_lecture_id_tag_key" ON "lecture_tags"("lecture_id", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_student_id_course_id_key" ON "enrollments"("student_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_student_id_course_instance_id_key" ON "enrollments"("student_id", "course_instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "lectures_chapter_id_lecture_number_key" ON "lectures"("chapter_id", "lecture_number");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_user_id_key" ON "teachers"("user_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_instances" ADD CONSTRAINT "course_instances_course_template_id_fkey" FOREIGN KEY ("course_template_id") REFERENCES "course_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_instances" ADD CONSTRAINT "course_instances_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_course_instance_id_fkey" FOREIGN KEY ("course_instance_id") REFERENCES "course_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_instance_id_fkey" FOREIGN KEY ("course_instance_id") REFERENCES "course_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_tags" ADD CONSTRAINT "lecture_tags_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
