import 'dotenv/config';
import Redis, { RedisOptions } from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'docker_redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_USER = process.env.REDIS_USER || '';  // Default to empty string if not provided
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || ''; // Default to empty string if not provided

const redisOptions: RedisOptions = {
    host: REDIS_HOST,
    port: REDIS_PORT,
};

if (REDIS_USER && REDIS_PASSWORD) {
    redisOptions.username = REDIS_USER;
    redisOptions.password = REDIS_PASSWORD;
} else if (REDIS_PASSWORD) {
    redisOptions.password = REDIS_PASSWORD;
}

const redisClient = new Redis(redisOptions);

const redisSubClient = new Redis(redisOptions);

export const getRedisClient = (): Redis => redisClient;

export const getRedisSubClient = (): Redis => redisSubClient;
