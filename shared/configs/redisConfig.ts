import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'docker_redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const redisClient = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
});

export const getRedisClient = (): Redis => redisClient;
