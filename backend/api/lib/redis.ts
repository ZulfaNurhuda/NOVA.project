import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// Only initialize Redis if REDIS_HOST is set
let redis: Redis | null = null;

if (REDIS_HOST) {
    redis = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
            // Reconnect after 2 seconds, max 50 times
            if (times > 50) {
                return null; // Stop retrying
            }
            return 2000;
        },
    });

    redis.on('error', (err) => {
        console.error('Redis connection error:', err);
    });

    redis.on('connect', () => {
        console.log('Connected to Redis successfully');
    });
}

export default redis;
