import prisma from '../config/db.js';
// import redisClient from '../config/redis.js';

/**
 * Advanced search using PostgreSQL Full-Text Search with fuzzy matching
 * Supports searching across teachers, course instances, students, and lectures
 */
export const advancedSearch = async (req, res) => {
    try {
        const { 
            query = '', 
            type = 'all', // 'all', 'teachers', 'courses', 'students', 'lectures'
            page = 1, 
            limit = 10,
            filters = {},
            sortBy = 'relevance', // 'relevance', 'date', 'name'
            sortOrder = 'desc'
        } = req.body;

        console.log('Advanced search request:', { query, type, page, limit, filters, sortBy, sortOrder });

        const offset = (page - 1) * limit;
        const searchQuery = query.trim();

        if (!searchQuery && Object.keys(filters).length === 0) {
            return res.status(400).json({ message: 'Search query or filters required' });
        }

        // Build search results
        const results = {
            teachers: [],
            courses: [],
            students: [],
            lectures: [],
            totalCount: 0,
            hasMore: false,
            page: parseInt(page),
            limit: parseInt(limit)
        };

        // Search Teachers
        if (type === 'all' || type === 'teachers') {
            const teacherResults = await searchTeachers(searchQuery, filters, offset, limit, sortBy, sortOrder);
            results.teachers = teacherResults.data;
            if (type === 'teachers') {
                results.totalCount = teacherResults.total;
                results.hasMore = teacherResults.hasMore;
            }
        }

        // Search Course Instances
        if (type === 'all' || type === 'courses') {
            const courseResults = await searchCourses(searchQuery, filters, offset, limit, sortBy, sortOrder);
            results.courses = courseResults.data;
            if (type === 'courses') {
                results.totalCount = courseResults.total;
                results.hasMore = courseResults.hasMore;
            }
        }

        // Search Students (admin only)
        if ((type === 'all' || type === 'students') && req.user?.role === 'admin') {
            const studentResults = await searchStudents(searchQuery, filters, offset, limit, sortBy, sortOrder);
            results.students = studentResults.data;
            if (type === 'students') {
                results.totalCount = studentResults.total;
                results.hasMore = studentResults.hasMore;
            }
        }

        // Search Lectures
        if (type === 'all' || type === 'lectures') {
            const lectureResults = await searchLectures(searchQuery, filters, offset, limit, sortBy, sortOrder);
            results.lectures = lectureResults.data;
            if (type === 'lectures') {
                results.totalCount = lectureResults.total;
                results.hasMore = lectureResults.hasMore;
            }
        }

        // Calculate total count for 'all' type
        if (type === 'all') {
            results.totalCount = results.teachers.length + results.courses.length + 
                               results.students.length + results.lectures.length;
            results.hasMore = results.totalCount >= limit;
        }

        console.log(`Search completed: ${results.totalCount} results found`);
        res.json(results);

    } catch (error) {
        console.error('Error executing advanced search:', error);
        res.status(500).json({ 
            message: 'Search error', 
            error: error.message 
        });
    }
};

/**
 * Search Teachers using PostgreSQL Full-Text Search
 */
const searchTeachers = async (query, filters, offset, limit, sortBy, sortOrder) => {
    try {
        const whereConditions = [];
        const searchTerms = [];

        // Full-text search on teacher and user data
        if (query) {
            const tsQuery = createTsQuery(query);
            whereConditions.push(`(
                to_tsvector('english', u.name || ' ' || u.email) @@ to_tsquery('english', $${searchTerms.length + 1})
            )`);
            searchTerms.push(tsQuery);
        }

        // Apply filters
        if (filters.courseCode) {
            whereConditions.push(`EXISTS (
                SELECT 1 FROM course_instances ci 
                JOIN course_templates ct ON ci.course_template_id = ct.id 
                WHERE ci.teacher_id = t.id AND ct.course_code ILIKE $${searchTerms.length + 1}
            )`);
            searchTerms.push(`%${filters.courseCode}%`);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        // Build ORDER BY clause
        let orderClause = 'ORDER BY ';
        if (sortBy === 'relevance' && query) {
            orderClause += `ts_rank(to_tsvector('english', u.name || ' ' || u.email), to_tsquery('english', $1)) DESC`;
        } else if (sortBy === 'name') {
            orderClause += `u.name ${sortOrder.toUpperCase()}`;
        } else {
            orderClause += `t.created_at ${sortOrder.toUpperCase()}`;
        }

        const searchSQL = `
            SELECT 
                t.id,
                t.user_id,
                u.name,
                u.email,
                u.created_at,
                COUNT(ci.id) as course_count,
                COUNT(DISTINCT e.id) as total_students,
                ${query ? `ts_rank(to_tsvector('english', u.name || ' ' || u.email), to_tsquery('english', $1)) as relevance_score` : '0 as relevance_score'}
            FROM teachers t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN course_instances ci ON t.id = ci.teacher_id AND ci.is_active = true
            LEFT JOIN enrollments e ON ci.id = e.course_instance_id
            ${whereClause}
            GROUP BY t.id, t.user_id, u.name, u.email, u.created_at
            ${orderClause}
            LIMIT $${searchTerms.length + 1} OFFSET $${searchTerms.length + 2}
        `;

        const countSQL = `
            SELECT COUNT(DISTINCT t.id) as total
            FROM teachers t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN course_instances ci ON t.id = ci.teacher_id AND ci.is_active = true
            ${whereClause}
        `;

        const [dataResult, countResult] = await Promise.all([
            prisma.$queryRawUnsafe(searchSQL, ...searchTerms, limit, offset),
            prisma.$queryRawUnsafe(countSQL, ...searchTerms)
        ]);

        const total = parseInt(countResult[0]?.total || 0);
        const hasMore = offset + dataResult.length < total;

        return {
            data: dataResult.map(teacher => ({
                id: teacher.id,
                type: 'teacher',
                user_id: teacher.user_id,
                name: teacher.name,
                email: teacher.email,
                course_count: parseInt(teacher.course_count),
                total_students: parseInt(teacher.total_students),
                relevance_score: parseFloat(teacher.relevance_score),
                created_at: teacher.created_at
            })),
            total,
            hasMore
        };
    } catch (error) {
        console.error('Error searching teachers:', error);
        return { data: [], total: 0, hasMore: false };
    }
};

/**
 * Search Course Instances using PostgreSQL Full-Text Search
 */
const searchCourses = async (query, filters, offset, limit, sortBy, sortOrder) => {
    try {
        const whereConditions = [];
        const searchTerms = [];

        // Full-text search on course data
        if (query) {
            const tsQuery = createTsQuery(query);
            whereConditions.push(`(
                to_tsvector('english', ct.name || ' ' || ct.course_code || ' ' || COALESCE(ct.description, '') || ' ' || u.name) 
                @@ to_tsquery('english', $${searchTerms.length + 1})
            )`);
            searchTerms.push(tsQuery);
        }

        // Apply filters
        if (filters.teacherName) {
            whereConditions.push(`u.name ILIKE $${searchTerms.length + 1}`);
            searchTerms.push(`%${filters.teacherName}%`);
        }

        if (filters.courseCode) {
            whereConditions.push(`ct.course_code ILIKE $${searchTerms.length + 1}`);
            searchTerms.push(`%${filters.courseCode}%`);
        }

        if (filters.isActive !== undefined) {
            whereConditions.push(`ci.is_active = $${searchTerms.length + 1}`);
            searchTerms.push(filters.isActive);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        // Build ORDER BY clause
        let orderClause = 'ORDER BY ';
        if (sortBy === 'relevance' && query) {
            orderClause += `ts_rank(to_tsvector('english', ct.name || ' ' || ct.course_code || ' ' || COALESCE(ct.description, '') || ' ' || u.name), to_tsquery('english', $1)) DESC`;
        } else if (sortBy === 'name') {
            orderClause += `ct.name ${sortOrder.toUpperCase()}`;
        } else {
            orderClause += `ci.created_at ${sortOrder.toUpperCase()}`;
        }

        const searchSQL = `
            SELECT 
                ci.id,
                ci.instance_name,
                ci.is_active,
                ci.created_at,
                ct.id as template_id,
                ct.name as course_name,
                ct.course_code,
                ct.description,
                t.id as teacher_id,
                u.name as teacher_name,
                COUNT(DISTINCT c.id) as chapter_count,
                COUNT(DISTINCT l.id) as lecture_count,
                COUNT(DISTINCT e.id) as enrollment_count,
                ${query ? `ts_rank(to_tsvector('english', ct.name || ' ' || ct.course_code || ' ' || COALESCE(ct.description, '') || ' ' || u.name), to_tsquery('english', $1)) as relevance_score` : '0 as relevance_score'}
            FROM course_instances ci
            JOIN course_templates ct ON ci.course_template_id = ct.id
            JOIN teachers t ON ci.teacher_id = t.id
            JOIN users u ON t.user_id = u.id
            LEFT JOIN chapters c ON ci.id = c.course_instance_id
            LEFT JOIN lectures l ON c.id = l.chapter_id
            LEFT JOIN enrollments e ON ci.id = e.course_instance_id
            ${whereClause}
            GROUP BY ci.id, ci.instance_name, ci.is_active, ci.created_at, ct.id, ct.name, ct.course_code, ct.description, t.id, u.name
            ${orderClause}
            LIMIT $${searchTerms.length + 1} OFFSET $${searchTerms.length + 2}
        `;

        const countSQL = `
            SELECT COUNT(DISTINCT ci.id) as total
            FROM course_instances ci
            JOIN course_templates ct ON ci.course_template_id = ct.id
            JOIN teachers t ON ci.teacher_id = t.id
            JOIN users u ON t.user_id = u.id
            ${whereClause}
        `;

        const [dataResult, countResult] = await Promise.all([
            prisma.$queryRawUnsafe(searchSQL, ...searchTerms, limit, offset),
            prisma.$queryRawUnsafe(countSQL, ...searchTerms)
        ]);

        const total = parseInt(countResult[0]?.total || 0);
        const hasMore = offset + dataResult.length < total;

        return {
            data: dataResult.map(course => ({
                id: course.id,
                type: 'course',
                instance_name: course.instance_name,
                course_name: course.course_name,
                course_code: course.course_code,
                description: course.description,
                teacher_id: course.teacher_id,
                teacher_name: course.teacher_name,
                is_active: course.is_active,
                chapter_count: parseInt(course.chapter_count),
                lecture_count: parseInt(course.lecture_count),
                enrollment_count: parseInt(course.enrollment_count),
                relevance_score: parseFloat(course.relevance_score),
                created_at: course.created_at
            })),
            total,
            hasMore
        };
    } catch (error) {
        console.error('Error searching courses:', error);
        return { data: [], total: 0, hasMore: false };
    }
};

/**
 * Search Students (Admin only)
 */
const searchStudents = async (query, filters, offset, limit, sortBy, sortOrder) => {
    try {
        const whereConditions = ['u.role = $1'];
        const searchTerms = ['student'];

        // Full-text search on student data
        if (query) {
            const tsQuery = createTsQuery(query);
            whereConditions.push(`(
                to_tsvector('english', u.name || ' ' || u.email) @@ to_tsquery('english', $${searchTerms.length + 1})
            )`);
            searchTerms.push(tsQuery);
        }

        // Apply filters
        if (filters.enrolledInCourse) {
            whereConditions.push(`EXISTS (
                SELECT 1 FROM enrollments e 
                JOIN course_instances ci ON e.course_instance_id = ci.id
                JOIN course_templates ct ON ci.course_template_id = ct.id
                WHERE e.student_id = u.id AND ct.course_code ILIKE $${searchTerms.length + 1}
            )`);
            searchTerms.push(`%${filters.enrolledInCourse}%`);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
        
        // Build ORDER BY clause
        let orderClause = 'ORDER BY ';
        if (sortBy === 'relevance' && query) {
            orderClause += `ts_rank(to_tsvector('english', u.name || ' ' || u.email), to_tsquery('english', $2)) DESC`;
        } else if (sortBy === 'name') {
            orderClause += `u.name ${sortOrder.toUpperCase()}`;
        } else {
            orderClause += `u.created_at ${sortOrder.toUpperCase()}`;
        }

        const searchSQL = `
            SELECT 
                u.id,
                u.name,
                u.email,
                u.created_at,
                COUNT(DISTINCT e.id) as enrolled_courses,
                COUNT(DISTINCT wh.id) as videos_watched,
                ${query ? `ts_rank(to_tsvector('english', u.name || ' ' || u.email), to_tsquery('english', $2)) as relevance_score` : '0 as relevance_score'}
            FROM users u
            LEFT JOIN enrollments e ON u.id = e.student_id
            LEFT JOIN watch_history wh ON u.id = wh.user_id
            ${whereClause}
            GROUP BY u.id, u.name, u.email, u.created_at
            ${orderClause}
            LIMIT $${searchTerms.length + 1} OFFSET $${searchTerms.length + 2}
        `;

        const countSQL = `
            SELECT COUNT(DISTINCT u.id) as total
            FROM users u
            LEFT JOIN enrollments e ON u.id = e.student_id
            ${whereClause}
        `;

        const [dataResult, countResult] = await Promise.all([
            prisma.$queryRawUnsafe(searchSQL, ...searchTerms, limit, offset),
            prisma.$queryRawUnsafe(countSQL, ...searchTerms)
        ]);

        const total = parseInt(countResult[0]?.total || 0);
        const hasMore = offset + dataResult.length < total;

        return {
            data: dataResult.map(student => ({
                id: student.id,
                type: 'student',
                name: student.name,
                email: student.email,
                enrolled_courses: parseInt(student.enrolled_courses),
                videos_watched: parseInt(student.videos_watched),
                relevance_score: parseFloat(student.relevance_score),
                created_at: student.created_at
            })),
            total,
            hasMore
        };
    } catch (error) {
        console.error('Error searching students:', error);
        return { data: [], total: 0, hasMore: false };
    }
};

/**
 * Search Lectures using PostgreSQL Full-Text Search
 */
const searchLectures = async (query, filters, offset, limit, sortBy, sortOrder) => {
    try {
        const whereConditions = [];
        const searchTerms = [];

        // Full-text search on lecture data including tags
        if (query) {
            const tsQuery = createTsQuery(query);
            whereConditions.push(`(
                to_tsvector('english', l.title || ' ' || COALESCE(l.description, '') || ' ' || c.name || ' ' || ct.name || ' ' || COALESCE(string_agg(DISTINCT lt.tag, ' '), '')) 
                @@ to_tsquery('english', $${searchTerms.length + 1})
            )`);
            searchTerms.push(tsQuery);
        }

        // Apply filters
        if (filters.courseCode) {
            whereConditions.push(`ct.course_code ILIKE $${searchTerms.length + 1}`);
            searchTerms.push(`%${filters.courseCode}%`);
        }

        if (filters.teacherName) {
            whereConditions.push(`u.name ILIKE $${searchTerms.length + 1}`);
            searchTerms.push(`%${filters.teacherName}%`);
        }

        if (filters.chapterName) {
            whereConditions.push(`c.name ILIKE $${searchTerms.length + 1}`);
            searchTerms.push(`%${filters.chapterName}%`);
        }

        // Tags filter - search in tags as keywords
        if (filters.tags) {
            const tagsQuery = createTsQuery(filters.tags);
            whereConditions.push(`(
                to_tsvector('english', string_agg(DISTINCT lt.tag, ' ')) 
                @@ to_tsquery('english', $${searchTerms.length + 1})
            )`);
            searchTerms.push(tagsQuery);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        // Build ORDER BY clause
        let orderClause = 'ORDER BY ';
        if (sortBy === 'relevance' && query) {
            orderClause += `ts_rank(to_tsvector('english', l.title || ' ' || COALESCE(l.description, '') || ' ' || c.name || ' ' || ct.name || ' ' || COALESCE(string_agg(DISTINCT lt.tag, ' '), '')), to_tsquery('english', $1)) DESC`;
        } else if (sortBy === 'name') {
            orderClause += `l.title ${sortOrder.toUpperCase()}`;
        } else {
            orderClause += `l.created_at ${sortOrder.toUpperCase()}`;
        }

        const searchSQL = `
            SELECT 
                l.id,
                l.title,
                l.description,
                l.youtube_url,
                l.duration,
                l.lecture_number,
                l.created_at,
                c.id as chapter_id,
                c.name as chapter_name,
                c.number as chapter_number,
                ci.id as course_instance_id,
                ct.name as course_name,
                ct.course_code,
                u.name as teacher_name,
                COUNT(DISTINCT wh.id) as watch_count,
                string_agg(DISTINCT lt.tag, ', ') as tags,
                ${query ? `ts_rank(to_tsvector('english', l.title || ' ' || COALESCE(l.description, '') || ' ' || c.name || ' ' || ct.name || ' ' || COALESCE(string_agg(DISTINCT lt.tag, ' '), '')), to_tsquery('english', $1)) as relevance_score` : '0 as relevance_score'}
            FROM lectures l
            JOIN chapters c ON l.chapter_id = c.id
            JOIN course_instances ci ON c.course_instance_id = ci.id
            JOIN course_templates ct ON ci.course_template_id = ct.id
            JOIN teachers t ON ci.teacher_id = t.id
            JOIN users u ON t.user_id = u.id
            LEFT JOIN lecture_tags lt ON l.id = lt.lecture_id
            LEFT JOIN watch_history wh ON l.id = wh.lecture_id
            GROUP BY l.id, l.title, l.description, l.youtube_url, l.duration, l.lecture_number, l.created_at,
                     c.id, c.name, c.number, ci.id, ct.name, ct.course_code, u.name
            ${whereConditions.length > 0 ? `HAVING ${whereConditions.join(' AND ')}` : ''}
            ${orderClause}
            LIMIT $${searchTerms.length + 1} OFFSET $${searchTerms.length + 2}
        `;

        const countSQL = `
            SELECT COUNT(DISTINCT l.id) as total
            FROM lectures l
            JOIN chapters c ON l.chapter_id = c.id
            JOIN course_instances ci ON c.course_instance_id = ci.id
            JOIN course_templates ct ON ci.course_template_id = ct.id
            JOIN teachers t ON ci.teacher_id = t.id
            JOIN users u ON t.user_id = u.id
            LEFT JOIN lecture_tags lt ON l.id = lt.lecture_id
            GROUP BY l.id, c.id, ci.id, ct.id, t.id, u.id
            ${whereConditions.length > 0 ? `HAVING ${whereConditions.join(' AND ')}` : ''}
        `;

        const [dataResult, countResult] = await Promise.all([
            prisma.$queryRawUnsafe(searchSQL, ...searchTerms, limit, offset),
            prisma.$queryRawUnsafe(countSQL, ...searchTerms)
        ]);

        const total = parseInt(countResult[0]?.total || 0);
        const hasMore = offset + dataResult.length < total;

        return {
            data: dataResult.map(lecture => ({
                id: lecture.id,
                type: 'lecture',
                title: lecture.title,
                description: lecture.description,
                youtube_url: lecture.youtube_url,
                duration: lecture.duration,
                lecture_number: lecture.lecture_number,
                chapter_id: lecture.chapter_id,
                chapter_name: lecture.chapter_name,
                chapter_number: lecture.chapter_number,
                course_instance_id: lecture.course_instance_id,
                course_name: lecture.course_name,
                course_code: lecture.course_code,
                teacher_name: lecture.teacher_name,
                watch_count: parseInt(lecture.watch_count),
                tags: lecture.tags || '', // Include tags in the response
                relevance_score: parseFloat(lecture.relevance_score),
                created_at: lecture.created_at
            })),
            total,
            hasMore
        };
    } catch (error) {
        console.error('Error searching lectures:', error);
        return { data: [], total: 0, hasMore: false };
    }
};

/**
 * Create a PostgreSQL tsquery with fuzzy search capabilities
 */
const createTsQuery = (query) => {
    // Split the query into words and handle special characters
    const words = query
        .replace(/[^\w\s]/g, ' ') // Replace special characters with spaces
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => {
            // Add fuzzy search by allowing partial matches
            if (word.length >= 3) {
                return `${word}:*`; // Prefix matching
            }
            return word;
        });

    // Join words with OR operator for broader matching
    return words.join(' | ');
};

/**
 * Quick search endpoint for autocomplete/suggestions
 */
export const quickSearch = async (req, res) => {
    try {
        const { query, limit = 5 } = req.query;
        
        if (!query || query.trim().length < 2) {
            return res.json({ suggestions: [] });
        }

        const tsQuery = createTsQuery(query);
        
        // Quick search across all entities for suggestions
        const suggestions = await Promise.all([
            // Teacher suggestions
            prisma.$queryRawUnsafe(`
                SELECT 'teacher' as type, u.name as title, u.email as subtitle, t.id
                FROM teachers t
                JOIN users u ON t.user_id = u.id
                WHERE to_tsvector('english', u.name || ' ' || u.email) @@ to_tsquery('english', $1)
                ORDER BY ts_rank(to_tsvector('english', u.name || ' ' || u.email), to_tsquery('english', $1)) DESC
                LIMIT $2
            `, tsQuery, Math.ceil(limit / 3)),
            
            // Course suggestions
            prisma.$queryRawUnsafe(`
                SELECT 'course' as type, ct.name as title, ct.course_code as subtitle, ci.id
                FROM course_instances ci
                JOIN course_templates ct ON ci.course_template_id = ct.id
                WHERE to_tsvector('english', ct.name || ' ' || ct.course_code) @@ to_tsquery('english', $1)
                ORDER BY ts_rank(to_tsvector('english', ct.name || ' ' || ct.course_code), to_tsquery('english', $1)) DESC
                LIMIT $2
            `, tsQuery, Math.ceil(limit / 3)),
            
            // Lecture suggestions
            prisma.$queryRawUnsafe(`
                SELECT 'lecture' as type, l.title, CONCAT(c.name, ' - ', ct.course_code) as subtitle, l.id
                FROM lectures l
                JOIN chapters c ON l.chapter_id = c.id
                JOIN course_instances ci ON c.course_instance_id = ci.id
                JOIN course_templates ct ON ci.course_template_id = ct.id
                LEFT JOIN lecture_tags lt ON l.id = lt.lecture_id
                WHERE to_tsvector('english', l.title || ' ' || COALESCE(l.description, '') || ' ' || COALESCE(string_agg(DISTINCT lt.tag, ' '), '')) @@ to_tsquery('english', $1)
                GROUP BY l.id, l.title, c.name, ct.course_code
                ORDER BY ts_rank(to_tsvector('english', l.title || ' ' || COALESCE(l.description, '') || ' ' || COALESCE(string_agg(DISTINCT lt.tag, ' '), '')), to_tsquery('english', $1)) DESC
                LIMIT $2
            `, tsQuery, Math.ceil(limit / 3))
        ]);

        const allSuggestions = suggestions.flat().slice(0, limit);
        
        res.json({ suggestions: allSuggestions });
    } catch (error) {
        console.error('Error in quick search:', error);
        res.status(500).json({ suggestions: [] });
    }
};

// Legacy search endpoint for backward compatibility
export const search = async (req, res) => {
    console.log('Legacy search endpoint called, redirecting to advanced search');
    return advancedSearch(req, res);
};
