import { getRedisClient } from '@shared/configs/redisConfig';

const redisClient = getRedisClient();

/**
 * Stores a simple key-value pair in Redis with an optional expiration time.
 * @param {string} key - The Redis key to store.
 * @param {string} value - The value to store.
 * @param {number} [ttl=3600] - The time-to-live (TTL) in seconds (default is 1 hour).
 * @returns {Promise<void>}
 */
export const setDataByKey = async (key: string, value: string, ttl: number = 3600): Promise<void> => {
    await redisClient.set(key, value, 'EX', ttl);
};

/**
 * Stores multiple fields in a Redis HASH.
 * @param {string} key - The Redis HASH key.
 * @param {Record<string, string>} data - The key-value data to store in the HASH.
 * @returns {Promise<void>}
 */
export const setDataByHashKey = async (key: string, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(key, data);
};

/**
 * Waits for a key to become available in Redis within a given timeout.
 * @param {string} key - The Redis key to watch.
 * @param {number} [timeout=10000] - Maximum time to wait (in milliseconds, default 10 seconds).
 * @param {number} [interval=100] - Polling interval (in milliseconds, default 100ms).
 * @returns {Promise<string | null>} - The value once the key is available, or throws an error if timeout is reached.
 * @throws {Error} If the timeout is exceeded before the key becomes available.
 */
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

/**
 * Waits for a specific field in a Redis HASH to become available within a given timeout.
 * @param {string} key - The Redis HASH key.
 * @param {string} field - The specific field to watch.
 * @param {number} [timeout=10000] - Maximum time to wait (in milliseconds, default 10 seconds).
 * @param {number} [interval=100] - Polling interval (in milliseconds, default 100ms).
 * @returns {Promise<string | null>} - The field value once available, or throws an error if timeout is reached.
 * @throws {Error} If the timeout is exceeded before the field becomes available.
 */
export const waitForHashKeyField = async (key: string, field: string, timeout = 10000, interval = 100): Promise<string | null> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const value = await redisClient.hget(key, field);
        if (value !== null) {
            return value;
        }
        await new Promise((resolve) => setTimeout(resolve, interval)); // Wait for the interval
    }

    throw new Error(`Timeout waiting for field '${field}' in key '${key}'`);
};

/**
 * Retrieves a simple key-value pair from Redis.
 * @param {string} key - The Redis key (must be a STRING).
 * @returns {Promise<string | null>} - The value or `null` if the key does not exist.
 */
export const getDataByKey = async (key: string): Promise<string | null> => {
    return await redisClient.get(key);
};

/**
 * Retrieves all fields from a Redis HASH.
 * @param {string} key - The Redis key (must be a HASH).
 * @returns {Promise<Record<string, string> | null>} - A key-value object containing all fields, or `null` if key does not exist.
 */
export const getDataByHashKey = async (key: string): Promise<Record<string, string> | null> => {
    const data = await redisClient.hgetall(key);
    return Object.keys(data).length > 0 ? data : null;
};

/**
 * Retrieves specific fields from a Redis HASH.
 * @param {string} key - The Redis key (must be a HASH).
 * @param {string[]} fields - The list of fields to retrieve.
 * @returns {Promise<Record<string, string> | null>} - A key-value object with requested fields, or `null` if no fields exist.
 */
export const getFieldsByHashKey = async (key: string, fields: string[]): Promise<Record<string, string> | null> => {
    const values = await redisClient.hmget(key, ...fields);

    if (!values.some(value => value !== null)) return null; // Check if all values are null

    return fields.reduce((acc, field, index) => {
        if (values[index] !== null) acc[field] = values[index]!;
        return acc;
    }, {} as Record<string, string>);
};

export default redisClient;
