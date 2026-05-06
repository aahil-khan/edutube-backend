import prisma from '../config/db.js';

// --- TEACHER METHODS ---

export const createRequest = async (req, res) => {
    try {
        const teacherId = req.teacher.id;
        const { request_type, course_name, course_code, description, resource_links, target_course_instance_id } = req.body;

        if (request_type === 'NEW_CONTENT' && !target_course_instance_id) {
            return res.status(400).json({ message: 'target_course_instance_id is required for NEW_CONTENT requests' });
        }
        if (request_type === 'NEW_COURSE' && !course_name) {
            return res.status(400).json({ message: 'course_name is required for NEW_COURSE requests' });
        }

        // Validate teacher owns target instance if NEW_CONTENT
        if (request_type === 'NEW_CONTENT') {
            const instance = await prisma.courseInstance.findFirst({
                where: { id: parseInt(target_course_instance_id), teacher_id: teacherId }
            });
            if (!instance) {
                return res.status(403).json({ message: 'You do not have access to this course instance' });
            }
        }

        const request = await prisma.courseRequest.create({
            data: {
                teacher_id: teacherId,
                request_type: request_type || 'NEW_COURSE',
                course_name,
                course_code,
                description,
                resource_links: resource_links || [],
                target_course_instance_id: target_course_instance_id ? parseInt(target_course_instance_id) : null
            }
        });

        res.status(201).json({ message: 'Request created successfully', request });
    } catch (error) {
        console.error('createRequest error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getMyRequests = async (req, res) => {
    try {
        const teacherId = req.teacher.id;
        const requests = await prisma.courseRequest.findMany({
            where: { teacher_id: teacherId },
            include: {
                target_course_instance: {
                    include: { course_template: true }
                },
                linked_instance: {
                    include: { course_template: true }
                }
            },
            orderBy: { created_at: 'desc' }
        });
        res.json({ requests });
    } catch (error) {
        console.error('getMyRequests error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateRequest = async (req, res) => {
    try {
        const teacherId = req.teacher.id;
        const requestId = parseInt(req.params.id);
        const { course_name, course_code, description, resource_links } = req.body;

        const existingReq = await prisma.courseRequest.findUnique({ where: { id: requestId } });
        if (!existingReq) return res.status(404).json({ message: 'Request not found' });
        if (existingReq.teacher_id !== teacherId) return res.status(403).json({ message: 'Forbidden' });
        if (existingReq.status !== 'pending') return res.status(400).json({ message: 'Can only edit pending requests' });

        const updated = await prisma.courseRequest.update({
            where: { id: requestId },
            data: {
                course_name: course_name !== undefined ? course_name : existingReq.course_name,
                course_code: course_code !== undefined ? course_code : existingReq.course_code,
                description: description !== undefined ? description : existingReq.description,
                resource_links: resource_links !== undefined ? resource_links : existingReq.resource_links
            }
        });

        res.json({ message: 'Request updated', request: updated });
    } catch (error) {
        console.error('updateRequest error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteRequest = async (req, res) => {
    try {
        const teacherId = req.teacher.id;
        const requestId = parseInt(req.params.id);

        const existingReq = await prisma.courseRequest.findUnique({ where: { id: requestId } });
        if (!existingReq) return res.status(404).json({ message: 'Request not found' });
        if (existingReq.teacher_id !== teacherId) return res.status(403).json({ message: 'Forbidden' });
        if (existingReq.status !== 'pending') return res.status(400).json({ message: 'Can only delete pending requests' });

        await prisma.courseRequest.delete({ where: { id: requestId } });
        res.json({ message: 'Request deleted successfully' });
    } catch (error) {
        console.error('deleteRequest error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getRequestById = async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const request = await prisma.courseRequest.findUnique({
            where: { id: requestId },
            include: {
                teacher: { include: { user: true } },
                target_course_instance: { include: { course_template: true } },
                linked_instance: { include: { course_template: true } }
            }
        });

        if (!request) return res.status(404).json({ message: 'Request not found' });

        // If teacher is accessing, check ownership. If admin, req.actor.role === 'admin' bypasses this.
        if (req.actor.role === 'teacher' && request.teacher_id !== req.teacher.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        res.json({ request });
    } catch (error) {
        console.error('getRequestById error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- ADMIN METHODS ---

export const getAllRequests = async (req, res) => {
    try {
        const requests = await prisma.courseRequest.findMany({
            include: {
                teacher: { include: { user: true } },
                target_course_instance: { include: { course_template: true } },
                linked_instance: { include: { course_template: true } }
            },
            orderBy: { created_at: 'desc' }
        });
        res.json({ requests });
    } catch (error) {
        console.error('getAllRequests error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateRequestStatus = async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { status, admin_notes, linked_instance_id } = req.body;

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const request = await prisma.courseRequest.update({
            where: { id: requestId },
            data: {
                status,
                admin_notes,
                linked_instance_id: linked_instance_id ? parseInt(linked_instance_id) : undefined
            },
            include: {
                teacher: { include: { user: true } },
                target_course_instance: { include: { course_template: true } },
                linked_instance: { include: { course_template: true } }
            }
        });

        res.json({ message: 'Request status updated', request });
    } catch (error) {
        console.error('updateRequestStatus error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
