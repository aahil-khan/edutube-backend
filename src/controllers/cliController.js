import prisma from '../config/db.js';
import { getVideoIdFromUrl } from '../utils/youtubeHelpers.js';
import { cliSuccess, cliError } from '../utils/cliResponse.js';

function lectureToSnake(lecture) {
    return {
        id: lecture.id,
        chapter_id: lecture.chapter_id,
        lecture_number: lecture.lecture_number,
        title: lecture.title,
        description: lecture.description,
        youtube_url: lecture.youtube_url,
        youtube_video_id: lecture.youtube_video_id,
        duration: lecture.duration,
        source: lecture.source
    };
}

export async function cliHealth(req, res) {
    return cliSuccess(res, {
        ok: true,
        key_name: req.cliKey.name
    });
}

export async function cliGetTree(req, res) {
    try {
        const teachers = await prisma.teacher.findMany({
            include: {
                user: { select: { name: true, email: true } },
                course_instances: {
                    include: {
                        course_template: true,
                        chapters: {
                            orderBy: { number: 'asc' },
                            include: {
                                lectures: {
                                    orderBy: { lecture_number: 'asc' }
                                }
                            }
                        }
                    },
                    orderBy: { id: 'asc' }
                }
            },
            orderBy: { id: 'asc' }
        });

        const data = {
            teachers: teachers.map((t) => ({
                id: t.id,
                display_name: t.user.name,
                course_instances: t.course_instances.map((ci) => ({
                    id: ci.id,
                    instance_name: ci.instance_name,
                    is_active: ci.is_active,
                    course_template: {
                        id: ci.course_template.id,
                        course_code: ci.course_template.course_code,
                        name: ci.course_template.name,
                        description: ci.course_template.description
                    },
                    chapters: ci.chapters.map((ch) => ({
                        id: ch.id,
                        number: ch.number,
                        name: ch.name,
                        description: ch.description,
                        lectures: ch.lectures.map(lectureToSnake)
                    }))
                }))
            }))
        };

        return cliSuccess(res, data);
    } catch (err) {
        console.error('cliGetTree', err);
        return cliError(res, 500, 'VALIDATION_ERROR', 'Failed to load course tree', {});
    }
}

export async function cliGetCourseInstanceTree(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return cliError(res, 400, 'VALIDATION_ERROR', 'Invalid course instance id', {});
        }

        const ci = await prisma.courseInstance.findUnique({
            where: { id },
            include: {
                course_template: true,
                teacher: {
                    include: { user: { select: { name: true } } }
                },
                chapters: {
                    orderBy: { number: 'asc' },
                    include: {
                        lectures: { orderBy: { lecture_number: 'asc' } }
                    }
                }
            }
        });

        if (!ci) {
            return cliError(res, 404, 'NOT_FOUND', 'Course instance not found', {});
        }

        const data = {
            course_instance: {
                id: ci.id,
                instance_name: ci.instance_name,
                is_active: ci.is_active,
                teacher: {
                    id: ci.teacher.id,
                    display_name: ci.teacher.user.name
                },
                course_template: {
                    id: ci.course_template.id,
                    course_code: ci.course_template.course_code,
                    name: ci.course_template.name,
                    description: ci.course_template.description
                },
                chapters: ci.chapters.map((ch) => ({
                    id: ch.id,
                    number: ch.number,
                    name: ch.name,
                    description: ch.description,
                    lectures: ch.lectures.map(lectureToSnake)
                }))
            }
        };

        return cliSuccess(res, data);
    } catch (err) {
        console.error('cliGetCourseInstanceTree', err);
        return cliError(res, 500, 'VALIDATION_ERROR', 'Failed to load course instance tree', {});
    }
}

export async function cliCreateChapter(req, res) {
    try {
        const { course_instance_id, name, description, number } = req.body;

        if (!name || course_instance_id === undefined || course_instance_id === null) {
            return cliError(res, 400, 'VALIDATION_ERROR', 'Missing required fields: name, course_instance_id', {});
        }

        const instance = await prisma.courseInstance.findUnique({
            where: { id: parseInt(course_instance_id, 10) }
        });

        if (!instance) {
            return cliError(res, 404, 'NOT_FOUND', 'Course instance not found', {});
        }

        const cid = parseInt(course_instance_id, 10);
        let finalChapterNumber = number;

        if (finalChapterNumber === undefined || finalChapterNumber === null) {
            const lastChapter = await prisma.chapter.findFirst({
                where: { course_instance_id: cid },
                orderBy: { number: 'desc' }
            });
            finalChapterNumber = lastChapter ? lastChapter.number + 1 : 1;
        } else {
            const existingChapter = await prisma.chapter.findFirst({
                where: {
                    course_instance_id: cid,
                    number: parseInt(number, 10)
                }
            });
            if (existingChapter) {
                return cliError(res, 409, 'CONFLICT', 'Chapter number already exists for this course instance', {});
            }
            finalChapterNumber = parseInt(number, 10);
        }

        const chapter = await prisma.chapter.create({
            data: {
                name,
                description: description !== undefined ? description : '',
                number: finalChapterNumber,
                course_instance_id: cid
            }
        });

        return cliSuccess(
            res,
            {
                chapter: {
                    id: chapter.id,
                    course_instance_id: chapter.course_instance_id,
                    number: chapter.number,
                    name: chapter.name,
                    description: chapter.description
                }
            },
            { status: 201, created: true }
        );
    } catch (err) {
        console.error('cliCreateChapter', err);
        return cliError(res, 500, 'VALIDATION_ERROR', 'Failed to create chapter', {});
    }
}

export async function cliRegisterLecture(req, res) {
    try {
        const {
            chapter_id,
            title,
            youtube_url,
            youtube_video_id,
            duration_seconds,
            lecture_number,
            idempotency_key
        } = req.body;

        if (req.body.tags !== undefined) {
            return cliError(res, 400, 'VALIDATION_ERROR', 'Field tags is not supported on register in v1', {});
        }

        if (
            !title ||
            !youtube_url ||
            !youtube_video_id ||
            chapter_id === undefined ||
            duration_seconds === undefined
        ) {
            return cliError(
                res,
                400,
                'VALIDATION_ERROR',
                'Missing required fields: chapter_id, title, youtube_url, youtube_video_id, duration_seconds',
                {}
            );
        }

        if (idempotency_key) {
            console.info('[cli] register idempotency_key (audit only)', {
                key_id: req.cliKey?.id,
                idempotency_key
            });
        }

        const vidFromUrl = getVideoIdFromUrl(youtube_url);
        if (!vidFromUrl || vidFromUrl !== youtube_video_id) {
            return cliError(
                res,
                400,
                'VALIDATION_ERROR',
                'youtube_video_id must match the video id in youtube_url',
                {}
            );
        }

        const existingByVideo = await prisma.lecture.findFirst({
            where: { youtube_video_id }
        });

        if (existingByVideo) {
            return cliSuccess(res, { lecture: lectureToSnake(existingByVideo) }, { created: false });
        }

        const chapter = await prisma.chapter.findUnique({
            where: { id: parseInt(chapter_id, 10) }
        });

        if (!chapter) {
            return cliError(res, 404, 'NOT_FOUND', 'Chapter not found', {});
        }

        let finalLectureNumber = lecture_number;
        const chId = parseInt(chapter_id, 10);

        if (finalLectureNumber === undefined || finalLectureNumber === null) {
            const lastLecture = await prisma.lecture.findFirst({
                where: { chapter_id: chId },
                orderBy: { lecture_number: 'desc' }
            });
            finalLectureNumber = lastLecture ? lastLecture.lecture_number + 1 : 1;
        } else {
            const n = parseInt(lecture_number, 10);
            const existingLecture = await prisma.lecture.findFirst({
                where: {
                    chapter_id: chId,
                    lecture_number: n
                }
            });
            if (existingLecture) {
                return cliError(res, 409, 'CONFLICT', 'Lecture number already exists in this chapter', {});
            }
            finalLectureNumber = n;
        }

        const durationInt = parseInt(duration_seconds, 10);
        if (Number.isNaN(durationInt) || durationInt < 0) {
            return cliError(res, 400, 'VALIDATION_ERROR', 'duration_seconds must be a non-negative integer', {});
        }

        const lecture = await prisma.lecture.create({
            data: {
                title,
                description: req.body.description !== undefined ? req.body.description : '',
                youtube_url,
                youtube_video_id,
                duration: durationInt,
                chapter_id: chId,
                lecture_number: finalLectureNumber,
                source: 'cli'
            }
        });

        return cliSuccess(res, { lecture: lectureToSnake(lecture) }, { status: 201, created: true });
    } catch (err) {
        if (err.code === 'P2002') {
            return cliError(res, 409, 'CONFLICT', 'Duplicate youtube_video_id', {});
        }
        console.error('cliRegisterLecture', err);
        return cliError(res, 500, 'VALIDATION_ERROR', 'Failed to register lecture', {});
    }
}

export async function cliGetLectureByVideo(req, res) {
    try {
        const { videoId } = req.params;
        const lecture = await prisma.lecture.findFirst({
            where: { youtube_video_id: videoId }
        });

        if (!lecture) {
            return cliError(res, 404, 'NOT_FOUND', 'No lecture with that video id', {});
        }

        return cliSuccess(res, { lecture: lectureToSnake(lecture) });
    } catch (err) {
        console.error('cliGetLectureByVideo', err);
        return cliError(res, 500, 'VALIDATION_ERROR', 'Failed to load lecture', {});
    }
}
