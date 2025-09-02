import prisma from '../config/db.js';

export const addWatchHistory = async (req, res) => {
    console.log('Watch history request body:', req.body);
    try {
        const userId = req.user.id;
        const { lecture_id, progress, current_time } = req.body;

        if (!lecture_id || progress === undefined) {
            return res.status(400).json({ message: 'lecture_id and progress are required' });
        }

        // Use findFirst approach to avoid composite key issues
        const existingHistory = await prisma.watchHistory.findFirst({
            where: {
                user_id: userId,
                lecture_id: parseInt(lecture_id)
            }
        });

        let result;
        if (existingHistory) {
            // Update existing record
            result = await prisma.watchHistory.update({
                where: {
                    id: existingHistory.id
                },
                data: {
                    progress: parseFloat(progress),
                    current_time: current_time ? parseInt(current_time) : 0,
                    last_watched: new Date()
                }
            });
        } else {
            // Create new record
            result = await prisma.watchHistory.create({
                data: {
                    user_id: userId,
                    lecture_id: parseInt(lecture_id),
                    progress: parseFloat(progress),
                    current_time: current_time ? parseInt(current_time) : 0
                }
            });
        }

        console.log('Watch history updated successfully:', result);
        res.status(200).json({ message: "Watch history updated successfully" });
    } catch (error) {
        console.error('Error updating watch history:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const getWatchHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Fetching watch history for user:', userId);

        // First, try a simple query to see if there are any watch history records
        const simpleHistory = await prisma.watchHistory.findMany({
            where: { user_id: userId }
        });

        console.log('Simple watch history count:', simpleHistory.length);

        if (simpleHistory.length === 0) {
            console.log('No watch history found for user');
            return res.json([]);
        }

        // If there are records, try the complex query
        const watchHistory = await prisma.watchHistory.findMany({
            where: { user_id: userId },
            include: {
                lecture: {
                    include: {
                        chapter: {
                            include: {
                                course_instance: {
                                    include: {
                                        course_template: true,
                                        teacher: {
                                            include: {
                                                user: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: {
                last_watched: 'desc'
            }
        });

        console.log('Complex watch history query successful');

        // Format the data for frontend consumption
        const formattedHistory = watchHistory.map(entry => {
            // Use the stored current_time if available, otherwise calculate from progress
            let current_time = entry.current_time || 0;
            if (current_time === 0 && entry.lecture.duration && entry.lecture.duration > 0) {
                current_time = Math.floor((entry.progress / 100) * entry.lecture.duration);
            } else if (current_time === 0) {
                // Fallback: if no duration, estimate based on typical video length
                current_time = Math.floor((entry.progress / 100) * 1800);
            }
            
            console.log('Processing entry:', {
                lecture_id: entry.lecture_id,
                progress: entry.progress,
                stored_current_time: entry.current_time,
                duration: entry.lecture.duration,
                final_current_time: current_time
            });
            
            return {
                id: entry.id,
                lecture_id: entry.lecture_id,
                lecture_number: entry.lecture.lecture_number,
                lecture_title: entry.lecture.title,
                lecture_description: entry.lecture.description,
                youtube_url: entry.lecture.youtube_url,
                duration: entry.lecture.duration,
                progress: entry.progress,
                last_watched: entry.last_watched,
                chapter_id: entry.lecture.chapter_id,
                chapter_number: entry.lecture.chapter.number,
                chapter_name: entry.lecture.chapter.name,
                course_instance_id: entry.lecture.chapter.course_instance_id,
                course_name: entry.lecture.chapter.course_instance.course_template.name,
                course_code: entry.lecture.chapter.course_instance.course_template.course_code,
                course_description: entry.lecture.chapter.course_instance.course_template.description,
                teacher_id: entry.lecture.chapter.course_instance.teacher_id,
                teacher_name: entry.lecture.chapter.course_instance.teacher.user.name,
                // Use the stored or calculated current_time
                current_time: current_time,
                // Additional UI helpers
                progress_percentage: Math.round(entry.progress),
                is_completed: entry.progress >= 95, // Consider 95%+ as completed
                formatted_duration: entry.lecture.duration ? formatDuration(entry.lecture.duration) : null
            };
        });

        console.log('Formatted history count:', formattedHistory.length);
        res.json(formattedHistory);
    } catch (error) {
        console.error('Error fetching watch history:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message,
            details: error.toString()
        });
    }
};

// Helper function to format duration
const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const getVideoProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        const lectureId = parseInt(req.params.lec_id);

        const watchHistory = await prisma.watchHistory.findFirst({
            where: {
                user_id: userId,
                lecture_id: lectureId
            }
        });

        if (!watchHistory) {
            return res.json({ progress: 0 });
        }

        res.json({ progress: watchHistory.progress });
    } catch (error) {
        console.error('Error fetching video progress:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const getRecentActivity = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 5;

        const recentHistory = await prisma.watchHistory.findMany({
            where: { user_id: userId },
            include: {
                lecture: {
                    include: {
                        chapter: {
                            include: {
                                course_instance: {
                                    include: {
                                        course_template: true,
                                        teacher: {
                                            include: {
                                                user: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: {
                last_watched: 'desc'
            },
            take: limit
        });

        // Format for dashboard display
        const formattedActivity = recentHistory.map(entry => {
            // Use the stored current_time if available, otherwise calculate from progress
            let current_time = entry.current_time || 0;
            if (current_time === 0 && entry.lecture.duration && entry.lecture.duration > 0) {
                current_time = Math.floor((entry.progress / 100) * entry.lecture.duration);
            } else if (current_time === 0) {
                // Fallback: if no duration, estimate based on typical video length
                current_time = Math.floor((entry.progress / 100) * 1800);
            }
            
            console.log('Recent activity entry:', {
                lecture_id: entry.lecture_id,
                progress: entry.progress,
                stored_current_time: entry.current_time,
                duration: entry.lecture.duration,
                final_current_time: current_time
            });
            
            return {
                id: entry.id,
                lecture_id: entry.lecture_id,
                lecture_title: entry.lecture.title,
                lecture_number: entry.lecture.lecture_number,
                chapter_number: entry.lecture.chapter.number,
                chapter_name: entry.lecture.chapter.name,
                course_instance_id: entry.lecture.chapter.course_instance_id,
                course_name: entry.lecture.chapter.course_instance.course_template.name,
                teacher_name: entry.lecture.chapter.course_instance.teacher.user.name,
                progress: Math.round(entry.progress),
                last_watched: entry.last_watched,
                duration: entry.lecture.duration,
                youtube_url: entry.lecture.youtube_url,
                current_time: current_time
            };
        });

        res.json(formattedActivity);
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).send('Server error');
    }
};
