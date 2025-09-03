import express from 'express';
import redisClient, { redisHelpers } from '../config/redis.js';

const router = express.Router();

// Redis health check
router.get('/health', async (req, res) => {
    try {
        // Test Redis connection
        await redisClient.ping();
        
        // Get some basic Redis info
        const info = await redisClient.info();
        const memory = await redisClient.memory('usage');
        
        res.json({
            status: 'connected',
            message: 'Redis is working properly',
            info: {
                memory_usage: memory,
                server_info: info.split('\r\n').slice(0, 5) // First 5 lines
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Redis connection failed',
            error: error.message
        });
    }
});

// Clear specific cache patterns (admin only)
router.delete('/cache/:pattern', async (req, res) => {
    try {
        const { pattern } = req.params;
        
        // Security check - only allow certain patterns
        const allowedPatterns = [
            'search:*',
            'courses:*',
            'teachers:*',
            'user:*'
        ];
        
        if (!allowedPatterns.some(allowed => pattern.startsWith(allowed.replace('*', '')))) {
            return res.status(403).json({ message: 'Pattern not allowed' });
        }
        
        if (pattern.includes('*')) {
            await redisHelpers.deleteCachePattern(pattern);
        } else {
            await redisHelpers.deleteCache(pattern);
        }
        
        res.json({ 
            message: `Cache cleared for pattern: ${pattern}`,
            pattern 
        });
    } catch (error) {
        res.status(500).json({
            message: 'Failed to clear cache',
            error: error.message
        });
    }
});

// Get cache statistics
router.get('/stats', async (req, res) => {
    try {
        const info = await redisClient.info('memory');
        const keyspace = await redisClient.info('keyspace');
        const stats = await redisClient.info('stats');
        
        // Get sample keys
        const keys = await redisClient.keys('*');
        const sampleKeys = keys.slice(0, 10);
        
        res.json({
            memory_info: info,
            keyspace_info: keyspace,
            stats_info: stats,
            total_keys: keys.length,
            sample_keys: sampleKeys
        });
    } catch (error) {
        res.status(500).json({
            message: 'Failed to get Redis stats',
            error: error.message
        });
    }
});

export default router;
