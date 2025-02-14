import { getRedisClient } from '@shared/configs/redisConfig';

const redisClient = getRedisClient();

export const getCache = async (key: string): Promise<string | null> => {
    return redisClient.get(key);
};

export const setCache = async (key: string, value: string, ttl: number = 3600): Promise<void> => {
    await redisClient.set(key, value, 'EX', ttl);
};

export const waitForKey = async (key: string, timeout = 10000, interval = 100): Promise<string | null> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const value = await redisClient.get(key);
        if (value !== null) {
            return value;
        }
        await new Promise((resolve) => setTimeout(resolve, interval)); // Wait for the interval
    }

    throw new Error(`Timeout waiting for key: ${key}`);
};
export const getHashByKey = async (key: string): Promise<{ [key: string]: string } | null> => {
    return redisClient.hgetall(key);
}

export default redisClient;