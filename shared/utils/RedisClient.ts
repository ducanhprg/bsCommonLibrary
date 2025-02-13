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
/**
 
 * @param {string} key
 * @param {number} batchSize 
 */
export const sscanKeys = async (key: string, batchSize: number = 100): Promise<string[]> => {
    let cursor = '0';
    let members: string[] = [];

    do {
        const [nextCursor, batch] = await redisClient.sscan(key, cursor, 'COUNT', batchSize);
        cursor = nextCursor;
        members.push(...batch);
    } while (cursor !== '0');

    return members;
};

/**
 *
 * @param {string} field 
 */
export const getHashFieldValue = async (hashKey: string, field: string): Promise<string | null> => {
    if (!hashKey || !field) {
        console.log("⚠️ Invalid parameters. Hash key and field are required.");
        return null;
    }

    try {
        console.log(`🔍 Fetching field '${field}' from Hash: ${hashKey}`);
        const value = await redisClient.hget(hashKey, field);

        if (value === null) {
            console.log(`⚠️ Field '${field}' not found in Hash: ${hashKey}`);
        } else {
            console.log(`✅ Found value for '${field}' in Hash '${hashKey}': ${value}`);
        }

        return value;
    } catch (error) {
        console.error(`❌ Error fetching field '${field}' from Hash '${hashKey}':`, error);
        return null;
    }
};
/**
 * @param {string} hashKey 
 * @param {Record<string, any>} fields 
 */
export const updateOrCreateHashFields = async (hashKey: string, fields: Record<string, any>) => {
    if (!hashKey || Object.keys(fields).length === 0) {
        console.log("⚠️ Invalid parameters. Hash key and fields are required.");
        return;
    }

    try {
        console.log(`🔄 Updating/Creating fields in Hash: ${hashKey}`);

        const pipeline = redisClient.pipeline();

        Object.entries(fields).forEach(([field, value]) => {
            pipeline.hset(hashKey, field, value.toString()); 
        });

        await pipeline.exec();
        console.log(`✅ Successfully updated/created fields in Hash: ${hashKey}`);
    } catch (error) {
        console.error(`❌ Error updating/creating Hash fields in ${hashKey}:`, error);
    }
};
/**
 *
 * @param {string} key 
 * @param {string[]} fields 
 */
export const getMultipleHashFields = async (key: string, fields: string[]): Promise<(string | null)[]> => {
    return redisClient.hmget(key, ...fields);
};

/**
 * 
 */
export const deleteCache = async (key: string): Promise<void> => {
    await redisClient.del(key);
};

/**
 * 
 */
export const existsCache = async (key: string): Promise<boolean> => {
    const exists = await redisClient.exists(key);
    return exists === 1;
};

/**
 * 
 * @param {string} setKey 
 * @param {string[]} members 
 */
export const addMembersToSet = async (setKey: string, members: string[]): Promise<void> => {
    if (members.length === 0) return;
    await redisClient.sadd(setKey, ...members);
    console.log(`✅ Added ${members.length} members to SET: ${setKey}`);
};

/**
 * 
 * @param {Record<string, Record<string, string>>} hashData 
 */
export const createHashForMembers = async (hashData: Record<string, Record<string, any>>): Promise<void> => {
    const pipeline = redisClient.pipeline();

    Object.entries(hashData).forEach(([key, fields]) => {
        
        const transformedFields = {
            ...fields,
            address_to_json: JSON.stringify(fields.address_to_json)
        };
        pipeline.hmset(key, transformedFields);
    });

    await pipeline.exec();
    console.log(`✅ Created ${Object.keys(hashData).length} hash records in Redis`);
};

/**
 *
 * @param {string} setKey 
 * @param {string} value 
 * @returns {Promise<boolean>}
 */
export const isMemberInSet = async (setKey: string, value: string): Promise<boolean> => {
    try {
        const result = await redisClient.sismember(setKey, value);
        return result === 1;
    } catch (error) {
        console.error(`❌ Error checking membership in SET ${setKey}:`, error);
        return false;
    }
};

/**
 *
 * @param {string} channel - Tên channel Redis
 * @param {string} message - Dữ liệu cần gửi (Tự format bên ngoài hàm)
 */
export const publishMessage = async (channel: string, message: string) => {
    try {
        await redisClient.publish(channel, message);
        console.log(`📢 [PUBLISH] Sent message: "${message}" to channel "${channel}"`);
    } catch (error) {
        console.error("❌ Error publishing message:", error);
    }
};