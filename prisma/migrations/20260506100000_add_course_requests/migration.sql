-- CreateTable
CREATE TABLE "course_requests" (
    "id" SERIAL NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "request_type" TEXT NOT NULL DEFAULT 'NEW_COURSE',
    "course_name" TEXT,
    "course_code" TEXT,
    "description" TEXT,
    "resource_links" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "admin_notes" TEXT,
    "target_course_instance_id" INTEGER,
    "linked_instance_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "course_requests"
ADD CONSTRAINT "course_requests_teacher_id_fkey"
FOREIGN KEY ("teacher_id")
REFERENCES "teachers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_requests"
ADD CONSTRAINT "course_requests_target_course_instance_id_fkey"
FOREIGN KEY ("target_course_instance_id")
REFERENCES "course_instances"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_requests"
ADD CONSTRAINT "course_requests_linked_instance_id_fkey"
FOREIGN KEY ("linked_instance_id")
REFERENCES "course_instances"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
