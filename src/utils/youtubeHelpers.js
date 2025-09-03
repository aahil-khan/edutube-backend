import axios from 'axios';

// YouTube playlist helper functions
export const getPlaylistIdFromUrl = (url) => {
    const regExp = /^.*(youtu.be\/|list=|\/playlist\?list=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2]) ? match[2] : null;
};

export const getVideoIdFromUrl = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// Mock YouTube API response for development
// In production, replace with actual YouTube Data API v3 calls
export const fetchPlaylistVideos = async (playlistId) => {
    try {
        // Production code with actual YouTube API:
        const API_KEY = process.env.YOUTUBE_API_KEY;
        if (!API_KEY) {
            throw new Error('YouTube API key not configured');
        }

        let allPlaylistItems = [];
        let nextPageToken = null;
        
        // Fetch all playlist items with pagination
        do {
            const playlistResponse = await axios.get(`https://www.googleapis.com/youtube/v3/playlistItems`, {
                params: {
                    part: 'snippet',
                    playlistId: playlistId,
                    maxResults: 50, // YouTube API max is 50 for playlistItems
                    key: API_KEY,
                    ...(nextPageToken && { pageToken: nextPageToken })
                }
            });

            if (!playlistResponse.data.items) {
                break;
            }

            allPlaylistItems = [...allPlaylistItems, ...playlistResponse.data.items];
            nextPageToken = playlistResponse.data.nextPageToken;
            
        } while (nextPageToken);

        if (allPlaylistItems.length === 0) {
            return {
                success: false,
                error: 'No videos found in playlist or playlist is private',
                videos: []
            };
        }

        // Process video IDs in batches (YouTube API allows max 50 video IDs per request)
        const videos = [];
        const batchSize = 50;
        
        for (let i = 0; i < allPlaylistItems.length; i += batchSize) {
            const batch = allPlaylistItems.slice(i, i + batchSize);
            const videoIds = batch.map(item => item.snippet.resourceId.videoId).join(',');

            // Fetch video details for duration
            const videosResponse = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
                params: {
                    part: 'contentDetails,snippet',
                    id: videoIds,
                    key: API_KEY
                }
            });

            const batchVideos = batch.map((item, index) => {
                const videoDetails = videosResponse.data.items.find(v => 
                    v.id === item.snippet.resourceId.videoId
                );
                
                return {
                    id: { videoId: item.snippet.resourceId.videoId },
                    snippet: {
                        ...item.snippet,
                        thumbnails: videoDetails?.snippet?.thumbnails || item.snippet.thumbnails
                    },
                    contentDetails: videoDetails?.contentDetails || { duration: 'PT0S' }
                };
            });

            videos.push(...batchVideos);
        }

        return {
            success: true,
            videos: videos,
            totalResults: videos.length
        };

    } catch (error) {
        console.error('Error fetching playlist videos:', error);
        
        // Handle specific YouTube API errors
        if (error.response) {
            const status = error.response.status;
            const message = error.response.data?.error?.message || error.message;
            
            if (status === 403) {
                return {
                    success: false,
                    error: 'YouTube API quota exceeded or invalid API key',
                    videos: []
                };
            } else if (status === 404) {
                return {
                    success: false,
                    error: 'Playlist not found or is private',
                    videos: []
                };
            } else {
                return {
                    success: false,
                    error: `YouTube API error: ${message}`,
                    videos: []
                };
            }
        }
        
        return {
            success: false,
            error: error.message,
            videos: []
        };
    }
};

// Convert YouTube duration (PT15M30S) to seconds
export const parseYouTubeDuration = (duration) => {
    if (!duration || duration === 'PT0S') return 0;
    
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    
    return hours * 3600 + minutes * 60 + seconds;
};

// Generate YouTube URL from video ID
export const generateYouTubeUrl = (videoId) => {
    return `https://www.youtube.com/watch?v=${videoId}`;
};
