import express from 'express';
import redisClient, { redisHelpers } from '../config/redis.js';

const router = express.Router();

// Redis health check
router.get('/health', async (req, res) => {
    try {
        // Test Redis connection
        const pingResult = await redisClient.ping();
        
        // Get some basic Redis info
        const info = await redisClient.info();
        const dbSize = await redisClient.dbSize();
        
        // Test basic operations
        const testKey = 'health_test';
        await redisClient.set(testKey, 'test_value', { EX: 10 });
        const testValue = await redisClient.get(testKey);
        await redisClient.del(testKey);
        
        res.json({
            status: 'connected',
            message: 'Redis is working properly',
            ping: pingResult,
            database_size: dbSize,
            test_operation: testValue === 'test_value' ? 'success' : 'failed',
            server_info: info.split('\r\n').slice(0, 5) // First 5 lines
        });
    } catch (error) {
        console.error('Redis health check error:', error);
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
        const info = await redisClient.info();
        const dbSize = await redisClient.dbSize();
        
        // Get sample keys
        const keys = await redisClient.keys('*');
        const sampleKeys = keys.slice(0, 10);
        
        // Group keys by prefix for better statistics
        const keyStats = {};
        keys.forEach(key => {
            const prefix = key.split(':')[0];
            keyStats[prefix] = (keyStats[prefix] || 0) + 1;
        });
        
        res.json({
            status: 'success',
            database_size: dbSize,
            total_keys: keys.length,
            key_distribution: keyStats,
            sample_keys: sampleKeys,
            server_info: info.split('\r\n').slice(0, 10),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Redis stats error:', error);
        res.status(500).json({
            message: 'Failed to get Redis stats',
            error: error.message
        });
    }
});

// Simple test endpoint to verify Redis operations
router.get('/test', async (req, res) => {
    try {
        const testData = {
            message: 'Redis test successful!',
            timestamp: new Date().toISOString(),
            random: Math.random()
        };
        
        // Set cache with 30 second expiration
        await redisHelpers.setCache('test_key', testData, 30);
        
        // Get it back
        const retrieved = await redisHelpers.getCache('test_key');
        
        res.json({
            status: 'success',
            original: testData,
            retrieved: retrieved,
            match: JSON.stringify(testData) === JSON.stringify(retrieved)
        });
        
    } catch (error) {
        console.error('Redis test error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Redis test failed',
            error: error.message
        });
    }
});

// Clear all cache (admin endpoint)
router.delete('/clear-all', async (req, res) => {
    try {
        await redisClient.flushDb();
        res.json({
            status: 'success',
            message: 'All cache cleared successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Clear cache error:', error);
        res.status(500).json({
            message: 'Failed to clear cache',
            error: error.message
        });
    }
});

export default router;
