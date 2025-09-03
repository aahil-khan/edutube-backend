import { redisHelpers } from '../config/redis.js';
import redisClient from '../config/redis.js';

// Redis health check
export const redisHealthCheck = async (req, res) => {
    try {
        // Test basic Redis operations
        const testKey = 'health_check';
        const testValue = { timestamp: new Date().toISOString(), test: 'Redis is working!' };
        
        // Set test data
        await redisHelpers.setCache(testKey, testValue, 60);
        
        // Get test data
        const retrieved = await redisHelpers.getCache(testKey);
        
        // Delete test data
        await redisHelpers.deleteCache(testKey);
        
        res.json({
            status: 'success',
            message: 'Redis is connected and working properly',
            test_data: retrieved,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Redis health check failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Redis health check failed',
            error: error.message
        });
    }
};

// Get Redis info
export const redisInfo = async (req, res) => {
    try {
        // Get Redis server info
        const info = await redisClient.info();
        const dbSize = await redisClient.dbSize();
        
        res.json({
            status: 'connected',
            database_size: dbSize,
            server_info: info.split('\r\n').slice(0, 10), // First 10 lines
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Redis info failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get Redis info',
            error: error.message
        });
    }
};

// Clear all cache (admin only)
export const clearAllCache = async (req, res) => {
    try {
        await redisClient.flushAll();
        
        res.json({
            status: 'success',
            message: 'All cache cleared successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Clear cache failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to clear cache',
            error: error.message
        });
    }
};

// Get cache statistics
export const getCacheStats = async (req, res) => {
    try {
        // Get all keys
        const allKeys = await redisClient.keys('*');
        
        // Group keys by prefix
        const keyStats = {};
        allKeys.forEach(key => {
            const prefix = key.split(':')[0];
            keyStats[prefix] = (keyStats[prefix] || 0) + 1;
        });
        
        res.json({
            status: 'success',
            total_keys: allKeys.length,
            key_distribution: keyStats,
            sample_keys: allKeys.slice(0, 10), // Show first 10 keys
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Cache stats failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get cache statistics',
            error: error.message
        });
    }
};
