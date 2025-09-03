import redis from 'redis';

// Create Redis client for local Windows installation
const redisClient = redis.createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
    },
    // For local installation, usually no password needed
    // password: process.env.REDIS_PASSWORD,
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

redisClient.on('connect', () => {
    console.log('Connected to Redis server');
});

redisClient.on('ready', () => {
    console.log('Redis client ready for commands');
});

redisClient.on('end', () => {
    console.log('Redis connection ended');
});

// Connect to Redis
const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log('✅ Redis connected successfully');
    } catch (error) {
        console.error('❌ Failed to connect to Redis:', error);
        console.log('Make sure Redis server is running on Windows');
    }
};

// Helper functions for common Redis operations
export const redisHelpers = {
    // Cache with expiration
    async setCache(key, value, expireInSeconds = 3600) {
        try {
            await redisClient.setEx(key, expireInSeconds, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Redis SET error:', error);
            return false;
        }
    },

    // Get cached data
    async getCache(key) {
        try {
            const value = await redisClient.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Redis GET error:', error);
            return null;
        }
    },

    // Delete cache
    async deleteCache(key) {
        try {
            await redisClient.del(key);
            return true;
        } catch (error) {
            console.error('Redis DELETE error:', error);
            return false;
        }
    },

    // Clear cache by pattern
    async deleteCachePattern(pattern) {
        try {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
            return true;
        } catch (error) {
            console.error('Redis DELETE PATTERN error:', error);
            return false;
        }
    },

    // Session management
    async setSession(sessionId, data, expireInSeconds = 86400) { // 24 hours
        try {
            await redisClient.setEx(`session:${sessionId}`, expireInSeconds, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Redis SESSION SET error:', error);
            return false;
        }
    },

    async getSession(sessionId) {
        try {
            const value = await redisClient.get(`session:${sessionId}`);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Redis SESSION GET error:', error);
            return null;
        }
    },

    async deleteSession(sessionId) {
        try {
            await redisClient.del(`session:${sessionId}`);
            return true;
        } catch (error) {
            console.error('Redis SESSION DELETE error:', error);
            return false;
        }
    }
};

// Initialize Redis connection
connectRedis();

export default redisClient;
