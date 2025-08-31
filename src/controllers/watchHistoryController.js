import prisma from '../config/db.js';

export const addWatchHistory = async (req, res) => {
    console.log(req.body);
    try {
        const userId = req.user.id;
        const { lecture_id, progress } = req.body;

        await prisma.watchHistory.upsert({
            where: {
                user_id_lecture_id: {
                    user_id: userId,
                    lecture_id: lecture_id
                }
            },
            update: {
                progress: progress,
                last_watched: new Date()
            },
            create: {
                user_id: userId,
                lecture_id: lecture_id,
                progress: progress
            }
        });

        res.status(200).json({ message: "Watch history updated successfully" });
    } catch (error) {
        console.error('Error updating watch history:', error);
        res.status(500).send('Server error');
    }
};

export const getWatchHistory = async (req, res) => {
    try {
        const userId = req.user.id;

        const watchHistory = await prisma.watchHistory.findMany({
            where: { user_id: userId },
            include: {
                lecture: {
                    include: {
                        course: true,
                        teacher: {
                            include: {
                                user: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                last_watched: 'desc'
            }
        });

        res.json(watchHistory);
    } catch (error) {
        console.error('Error fetching watch history:', error);
        res.status(500).send('Server error');
    }
};

export const getVideoProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        const lectureId = parseInt(req.params.lec_id);

        const watchHistory = await prisma.watchHistory.findUnique({
            where: {
                user_id_lecture_id: {
                    user_id: userId,
                    lecture_id: lectureId
                }
            }
        });

        if (!watchHistory) {
            return res.json({ progress: 0 });
        }

        res.json({ progress: watchHistory.progress });
    } catch (error) {
        console.error('Error fetching video progress:', error);
        res.status(500).send('Server error');
    }
};
