import { redisHelpers } from '../config/redis.js';

// Cache invalidation utility functions
export const cacheInvalidation = {
    // Invalidate course-related caches
    async invalidateCourseCache(courseId, teacherId = null) {
        const patterns = [
            `course:${courseId}`,
            'courses:browse:all',
            `search:*`, // Invalidate all search caches
        ];
        
        if (teacherId) {
            patterns.push(`teacher:courses:${teacherId}`);
            patterns.push(`teacher:details:${teacherId}`);
        }
        
        for (const pattern of patterns) {
            if (pattern.includes('*')) {
                await redisHelpers.deleteCachePattern(pattern);
            } else {
                await redisHelpers.deleteCache(pattern);
            }
        }
        console.log(`Invalidated course cache for course ${courseId}`);
    },

    // Invalidate teacher-related caches
    async invalidateTeacherCache(teacherId) {
        const patterns = [
            `teacher:courses:${teacherId}`,
            `teacher:details:${teacherId}`,
            'teachers:public:*',
            'search:*'
        ];
        
        for (const pattern of patterns) {
            if (pattern.includes('*')) {
                await redisHelpers.deleteCachePattern(pattern);
            } else {
                await redisHelpers.deleteCache(pattern);
            }
        }
        console.log(`Invalidated teacher cache for teacher ${teacherId}`);
    },

    // Invalidate user-related caches
    async invalidateUserCache(userId) {
        const patterns = [
            `user:${userId}`,
            'search:*'
        ];
        
        for (const pattern of patterns) {
            if (pattern.includes('*')) {
                await redisHelpers.deleteCachePattern(pattern);
            } else {
                await redisHelpers.deleteCache(pattern);
            }
        }
        console.log(`Invalidated user cache for user ${userId}`);
    },

    // Invalidate all search caches
    async invalidateSearchCache() {
        await redisHelpers.deleteCachePattern('search:*');
        console.log('Invalidated all search caches');
    },

    // Invalidate enrollment-related caches
    async invalidateEnrollmentCache(courseId, studentId, teacherId = null) {
        const patterns = [
            `course:${courseId}`,
            'courses:browse:all',
            'search:*'
        ];
        
        if (teacherId) {
            patterns.push(`teacher:courses:${teacherId}`);
            patterns.push(`teacher:details:${teacherId}`);
        }
        
        for (const pattern of patterns) {
            if (pattern.includes('*')) {
                await redisHelpers.deleteCachePattern(pattern);
            } else {
                await redisHelpers.deleteCache(pattern);
            }
        }
        console.log(`Invalidated enrollment cache for course ${courseId}, student ${studentId}`);
    },

    // Clear all caches (use sparingly)
    async clearAllCache() {
        await redisHelpers.deleteCachePattern('*');
        console.log('Cleared all Redis cache');
    }
};

// Middleware to invalidate cache after successful operations
export const invalidateCacheMiddleware = (type, getParams) => {
    return async (req, res, next) => {
        // Store original res.json to intercept successful responses
        const originalJson = res.json;
        
        res.json = function(data) {
            // Only invalidate cache for successful responses (2xx status codes)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Extract parameters using the provided function
                const params = getParams(req, data);
                
                // Invalidate cache based on type
                switch(type) {
                    case 'course':
                        cacheInvalidation.invalidateCourseCache(params.courseId, params.teacherId);
                        break;
                    case 'teacher':
                        cacheInvalidation.invalidateTeacherCache(params.teacherId);
                        break;
                    case 'user':
                        cacheInvalidation.invalidateUserCache(params.userId);
                        break;
                    case 'enrollment':
                        cacheInvalidation.invalidateEnrollmentCache(params.courseId, params.studentId, params.teacherId);
                        break;
                    case 'search':
                        cacheInvalidation.invalidateSearchCache();
                        break;
                }
            }
            
            // Call original res.json
            return originalJson.call(this, data);
        };
        
        next();
    };
};
