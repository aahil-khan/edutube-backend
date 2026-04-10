import prisma from '../config/db.js';

const TEMP_HIGH = 2_000_000_000; // one slot for cross-chapter insert before final renumber

/**
 * WatchHistory.progress (0–100) at or above this fraction counts as one completion (per lecture analytics).
 * Display copy in UI: "Completed (≥90%)".
 */
export const TEACHER_COMPLETION_THRESHOLD = 0.9;
const COMPLETION_PROGRESS_MIN = TEACHER_COMPLETION_THRESHOLD * 100;

async function assertLectureOwnedByTeacher(teacherId, lectureId) {
    const lecture = await prisma.lecture.findFirst({
        where: { id: lectureId },
        include: {
            chapter: {
                include: { course_instance: true }
            }
        }
    });
    if (!lecture || lecture.chapter.course_instance.teacher_id !== teacherId) {
        return null;
    }
    return lecture;
}

async function assertChapterOwnedByTeacher(teacherId, chapterId) {
    const chapter = await prisma.chapter.findFirst({
        where: { id: chapterId },
        include: { course_instance: true }
    });
    if (!chapter || chapter.course_instance.teacher_id !== teacherId) {
        return null;
    }
    return chapter;
}

async function assertInstanceOwnedByTeacher(teacherId, instanceId) {
    const inst = await prisma.courseInstance.findFirst({
        where: { id: instanceId, teacher_id: teacherId },
        include: {
            course_template: { select: { id: true, name: true, course_code: true } }
        }
    });
    return inst;
}

/** Two-phase renumber lectures in one chapter (ids in final order) */
async function renumberLecturesInChapter(tx, chapterId, orderedLectureIds) {
    for (let i = 0; i < orderedLectureIds.length; i++) {
        await tx.lecture.update({
            where: { id: orderedLectureIds[i], chapter_id: chapterId },
            data: { lecture_number: -(i + 1) }
        });
    }
    for (let i = 0; i < orderedLectureIds.length; i++) {
        await tx.lecture.update({
            where: { id: orderedLectureIds[i], chapter_id: chapterId },
            data: { lecture_number: i + 1 }
        });
    }
}

export const getMyInstances = async (req, res) => {
    try {
        const teacherId = req.teacher.id;
        const instances = await prisma.courseInstance.findMany({
            where: { teacher_id: teacherId },
            include: {
                course_template: {
                    select: { id: true, name: true, course_code: true, description: true }
                },
                _count: {
                    select: { chapters: true, enrollments: true }
                }
            },
            orderBy: { created_at: 'desc' }
        });
        res.json({ instances });
    } catch (error) {
        console.error('getMyInstances error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getInstanceChapters = async (req, res) => {
    try {
        const instanceId = parseInt(req.params.id, 10);
        if (Number.isNaN(instanceId)) {
            return res.status(400).json({ message: 'Invalid instance id' });
        }

        const inst = await assertInstanceOwnedByTeacher(req.teacher.id, instanceId);
        if (!inst) {
            return res.status(404).json({ message: 'Course instance not found' });
        }

        const chapters = await prisma.chapter.findMany({
            where: { course_instance_id: instanceId },
            orderBy: { number: 'asc' },
            include: {
                lectures: {
                    orderBy: { lecture_number: 'asc' },
                    include: {
                        tags: { orderBy: { tag: 'asc' } }
                    }
                },
                _count: { select: { lectures: true } }
            }
        });

        res.json({
            instance: inst,
            chapters
        });
    } catch (error) {
        console.error('getInstanceChapters error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const createChapterTeacher = async (req, res) => {
    try {
        const { name, course_instance_id, description, number } = req.body;

        if (!name || !course_instance_id) {
            return res.status(400).json({
                message: 'Missing required fields: name, course_instance_id'
            });
        }

        const instanceId = parseInt(course_instance_id, 10);
        const inst = await assertInstanceOwnedByTeacher(req.teacher.id, instanceId);
        if (!inst) {
            return res.status(404).json({ message: 'Course instance not found' });
        }

        let finalChapterNumber = number;
        if (!finalChapterNumber) {
            const lastChapter = await prisma.chapter.findFirst({
                where: { course_instance_id: instanceId },
                orderBy: { number: 'desc' }
            });
            finalChapterNumber = lastChapter ? lastChapter.number + 1 : 1;
        } else {
            const existingChapter = await prisma.chapter.findFirst({
                where: {
                    course_instance_id: instanceId,
                    number: parseInt(number, 10)
                }
            });
            if (existingChapter) {
                return res.status(400).json({
                    message: 'Chapter number already exists for this course instance'
                });
            }
        }

        const chapter = await prisma.chapter.create({
            data: {
                name,
                description: description || '',
                number: parseInt(finalChapterNumber, 10),
                course_instance_id: instanceId
            },
            include: {
                course_instance: {
                    include: {
                        course_template: { select: { course_code: true, name: true } }
                    }
                },
                _count: { select: { lectures: true } }
            }
        });

        res.status(201).json({ message: 'Chapter created successfully', chapter });
    } catch (error) {
        console.error('createChapterTeacher error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateChapterTeacher = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { name, description, number } = req.body;

        const chapter = await assertChapterOwnedByTeacher(req.teacher.id, id);
        if (!chapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (number !== undefined) updateData.number = parseInt(number, 10);

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No data provided for update' });
        }

        const updated = await prisma.chapter.update({
            where: { id },
            data: updateData,
            include: {
                course_instance: {
                    include: {
                        course_template: { select: { course_code: true, name: true } }
                    }
                },
                _count: { select: { lectures: true } }
            }
        });

        res.json({ message: 'Chapter updated successfully', chapter: updated });
    } catch (error) {
        console.error('updateChapterTeacher error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const reorderChaptersTeacher = async (req, res) => {
    try {
        const { courseInstanceId, chapterOrders } = req.body;

        if (!courseInstanceId || !chapterOrders || !Array.isArray(chapterOrders)) {
            return res.status(400).json({
                message: 'courseInstanceId and chapterOrders array are required'
            });
        }

        const inst = await assertInstanceOwnedByTeacher(
            req.teacher.id,
            parseInt(courseInstanceId, 10)
        );
        if (!inst) {
            return res.status(404).json({ message: 'Course instance not found' });
        }

        const courseInstanceIdInt = parseInt(courseInstanceId, 10);

        await prisma.$transaction(async (tx) => {
            for (let i = 0; i < chapterOrders.length; i++) {
                const order = chapterOrders[i];
                await tx.chapter.update({
                    where: {
                        id: parseInt(order.id, 10),
                        course_instance_id: courseInstanceIdInt
                    },
                    data: { number: -(i + 1) }
                });
            }
            for (const order of chapterOrders) {
                await tx.chapter.update({
                    where: {
                        id: parseInt(order.id, 10),
                        course_instance_id: courseInstanceIdInt
                    },
                    data: { number: parseInt(order.number, 10) }
                });
            }
        });

        res.json({ message: 'Chapters reordered successfully' });
    } catch (error) {
        console.error('reorderChaptersTeacher error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * PUT body: title, description, tags (array replaces all tags).
 * youtube_url, chapter_id, lecture_number, duration are not applied (stripped).
 */
export const updateLectureTeacher = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const lecture = await assertLectureOwnedByTeacher(req.teacher.id, id);
        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        const { title, description, tags } = req.body;

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;

        await prisma.$transaction(async (tx) => {
            if (Object.keys(updateData).length > 0) {
                await tx.lecture.update({
                    where: { id },
                    data: updateData
                });
            }

            if (tags !== undefined) {
                await tx.lectureTag.deleteMany({ where: { lecture_id: id } });
                if (Array.isArray(tags) && tags.length > 0) {
                    const tagData = tags.map((tag) => ({
                        lecture_id: id,
                        tag: String(tag).trim().toLowerCase()
                    })).filter((t) => t.tag.length > 0);

                    if (tagData.length > 0) {
                        await tx.lectureTag.createMany({
                            data: tagData,
                            skipDuplicates: true
                        });
                    }
                }
            }
        });

        const updatedLecture = await prisma.lecture.findUnique({
            where: { id },
            include: {
                tags: { orderBy: { tag: 'asc' } },
                chapter: {
                    include: {
                        course_instance: {
                            include: {
                                course_template: { select: { course_code: true, name: true } }
                            }
                        }
                    }
                }
            }
        });

        res.json({ message: 'Lecture updated successfully', lecture: updatedLecture });
    } catch (error) {
        console.error('updateLectureTeacher error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const moveLectureTeacher = async (req, res) => {
    try {
        const lectureId = parseInt(req.params.id, 10);
        const { target_chapter_id, target_lecture_number } = req.body;

        if (Number.isNaN(lectureId)) {
            return res.status(400).json({ message: 'Invalid lecture id' });
        }
        if (target_chapter_id === undefined || target_chapter_id === null) {
            return res.status(400).json({ message: 'target_chapter_id is required' });
        }

        const targetChapterId = parseInt(target_chapter_id, 10);
        if (Number.isNaN(targetChapterId)) {
            return res.status(400).json({ message: 'Invalid target_chapter_id' });
        }

        const teacherId = req.teacher.id;

        await prisma.$transaction(async (tx) => {
            const lecture = await tx.lecture.findFirst({
                where: { id: lectureId },
                include: {
                    chapter: {
                        include: { course_instance: true }
                    }
                }
            });

            if (!lecture || lecture.chapter.course_instance.teacher_id !== teacherId) {
                const err = new Error('Forbidden');
                err.statusCode = 403;
                throw err;
            }

            const sourceChapterId = lecture.chapter_id;
            const instanceId = lecture.chapter.course_instance_id;

            const targetChapter = await tx.chapter.findFirst({
                where: { id: targetChapterId, course_instance_id: instanceId }
            });
            if (!targetChapter) {
                const err = new Error('Target chapter not found in this course');
                err.statusCode = 404;
                throw err;
            }

            // Intra-chapter reorder
            if (sourceChapterId === targetChapterId) {
                const all = await tx.lecture.findMany({
                    where: { chapter_id: sourceChapterId },
                    orderBy: { lecture_number: 'asc' }
                });
                const ids = all.map((l) => l.id);
                const without = ids.filter((lid) => lid !== lectureId);
                let insertIndex =
                    target_lecture_number !== undefined && target_lecture_number !== null
                        ? Math.min(
                              Math.max(1, parseInt(target_lecture_number, 10)),
                              without.length + 1
                          ) - 1
                        : without.length;
                const newOrder = [
                    ...without.slice(0, insertIndex),
                    lectureId,
                    ...without.slice(insertIndex)
                ];
                await renumberLecturesInChapter(tx, sourceChapterId, newOrder);
                return;
            }

            // Cross-chapter: isolate L so renumbering others cannot clash on @@unique([chapter_id, lecture_number])
            await tx.lecture.update({
                where: { id: lectureId },
                data: { lecture_number: -1 }
            });

            const sourceOthers = await tx.lecture.findMany({
                where: { chapter_id: sourceChapterId, id: { not: lectureId } },
                orderBy: { lecture_number: 'asc' }
            });
            const sourceIds = sourceOthers.map((l) => l.id);
            await renumberLecturesInChapter(tx, sourceChapterId, sourceIds);

            await tx.lecture.update({
                where: { id: lectureId },
                data: { chapter_id: targetChapterId, lecture_number: TEMP_HIGH }
            });

            const targetExisting = await tx.lecture.findMany({
                where: { chapter_id: targetChapterId, id: { not: lectureId } },
                orderBy: { lecture_number: 'asc' }
            });
            const targetIds = targetExisting.map((l) => l.id);

            let insertAt;
            if (target_lecture_number === undefined || target_lecture_number === null) {
                insertAt = targetIds.length;
            } else {
                const p = parseInt(target_lecture_number, 10);
                insertAt = Math.min(Math.max(0, p - 1), targetIds.length);
            }

            const mergedOrder = [
                ...targetIds.slice(0, insertAt),
                lectureId,
                ...targetIds.slice(insertAt)
            ];
            await renumberLecturesInChapter(tx, targetChapterId, mergedOrder);
        });

        const updated = await prisma.lecture.findUnique({
            where: { id: lectureId },
            include: {
                tags: { orderBy: { tag: 'asc' } },
                chapter: true
            }
        });

        res.json({ message: 'Lecture moved successfully', lecture: updated });
    } catch (error) {
        if (error.statusCode === 403) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        if (error.statusCode === 404) {
            return res.status(404).json({ message: error.message });
        }
        console.error('moveLectureTeacher error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * GET /api/teacher/instances/:id/analytics
 * Ownership: CourseInstance must belong to req.teacher.id — otherwise 404 (no id leak).
 */
export const getInstanceAnalytics = async (req, res) => {
    try {
        const instanceId = parseInt(req.params.id, 10);
        if (Number.isNaN(instanceId)) {
            return res.status(400).json({ message: 'Invalid instance id' });
        }

        const inst = await assertInstanceOwnedByTeacher(req.teacher.id, instanceId);
        if (!inst) {
            return res.status(404).json({ message: 'Course instance not found' });
        }

        const [enrollment_count, chapter_count, lecture_count] = await Promise.all([
            prisma.enrollment.count({ where: { course_instance_id: instanceId } }),
            prisma.chapter.count({ where: { course_instance_id: instanceId } }),
            prisma.lecture.count({
                where: { chapter: { course_instance_id: instanceId } }
            })
        ]);

        const activeRows = await prisma.$queryRaw`
            SELECT COUNT(DISTINCT wh.user_id)::int AS c
            FROM watch_history wh
            INNER JOIN lectures l ON l.id = wh.lecture_id
            INNER JOIN chapters c ON c.id = l.chapter_id
            WHERE c.course_instance_id = ${instanceId}
        `;
        const active_students = activeRows[0]?.c ?? 0;

        const lectureRows = await prisma.$queryRaw`
            SELECT
                l.id AS lecture_id,
                l.title,
                COALESCE((
                    SELECT COUNT(DISTINCT wh.user_id)::int
                    FROM watch_history wh
                    WHERE wh.lecture_id = l.id
                ), 0) AS students_with_progress,
                COALESCE((
                    SELECT AVG(wh.progress)
                    FROM watch_history wh
                    WHERE wh.lecture_id = l.id
                ), 0) AS average_progress,
                COALESCE((
                    SELECT COUNT(*)::int
                    FROM watch_history wh
                    WHERE wh.lecture_id = l.id AND wh.progress >= ${COMPLETION_PROGRESS_MIN}
                ), 0) AS completions
            FROM lectures l
            INNER JOIN chapters c ON c.id = l.chapter_id
            WHERE c.course_instance_id = ${instanceId}
            ORDER BY c.number ASC, l.lecture_number ASC
        `;

        const lectures = lectureRows.map((row) => ({
            lecture_id: Number(row.lecture_id),
            title: row.title,
            students_with_progress: Number(row.students_with_progress),
            average_progress:
                row.average_progress != null
                    ? Math.round(Number(row.average_progress) * 10) / 10
                    : 0,
            completions: Number(row.completions)
        }));

        res.json({
            data: {
                enrollment_count,
                chapter_count,
                lecture_count,
                active_students: Number(active_students),
                lectures
            }
        });
    } catch (error) {
        console.error('getInstanceAnalytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * GET /api/teacher/analytics/summary
 */
export const getAnalyticsSummary = async (req, res) => {
    try {
        const teacherId = req.teacher.id;

        const rows = await prisma.$queryRaw`
            SELECT
                ci.id AS instance_id,
                ci.instance_name,
                ct.course_code,
                (SELECT COUNT(*)::int FROM enrollments e WHERE e.course_instance_id = ci.id) AS enrollment_count,
                COALESCE((
                    SELECT COUNT(DISTINCT wh.user_id)::int
                    FROM watch_history wh
                    INNER JOIN lectures l ON l.id = wh.lecture_id
                    INNER JOIN chapters c ON c.id = l.chapter_id
                    WHERE c.course_instance_id = ci.id
                ), 0) AS active_students
            FROM course_instances ci
            INNER JOIN course_templates ct ON ct.id = ci.course_template_id
            WHERE ci.teacher_id = ${teacherId}
            ORDER BY ci.created_at DESC
        `;

        const instances = rows.map((row) => ({
            instance_id: Number(row.instance_id),
            instance_name: row.instance_name,
            course_code: row.course_code,
            enrollment_count: Number(row.enrollment_count),
            active_students: Number(row.active_students)
        }));

        res.json({ data: { instances } });
    } catch (error) {
        console.error('getAnalyticsSummary error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
