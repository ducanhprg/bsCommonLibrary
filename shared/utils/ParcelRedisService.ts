import redisClient from './RedisClient';

/**
 * Creates a new parcel request in Redis.
 * @param {number} parcelRequestId - The unique ID of the parcel request: parcel_request_id
 * @param {Record<string, string>} data - The key-value data to store in Redis.
 */
export const createParcelRequest = async (parcelRequestId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`parcel_request:${parcelRequestId}`, data);
};

/**
 * Updates fields in an existing parcel request.
 * @param {number} parcelRequestId - The parcel request ID: parcel_request_id
 * @param {Record<string, string>} data - The key-value data to update.
 */
export const updateParcelRequest = async (parcelRequestId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`parcel_request:${parcelRequestId}`, data);
};

/**
 * Deletes specific fields from a parcel request.
 * @param {number} parcelRequestId - The parcel request ID: parcel_request_id
 * @param {string[]} fields - The list of fields to delete.
 */
export const deleteParcelRequestFields = async (parcelRequestId: number, fields: string[]): Promise<void> => {
    await redisClient.hdel(`parcel_request:${parcelRequestId}`, ...fields);
};

/**
 * Creates a parcel request item and links it to a parcel request.
 * @param {number} parcelRequestId - The parent parcel request ID: parcel_request_id
 * @param {number} parcelRequestItemId - The parcel request item ID: parcel_request_item_id
 * @param {Record<string, string>} data - The item details.
 */
export const addParcelRequestItem = async (parcelRequestId: number, parcelRequestItemId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`parcel_request_item:${parcelRequestItemId}`, data);
    await redisClient.sadd(`parcel_request:${parcelRequestId}:items`, parcelRequestItemId);
};

/**
 * Updates fields in an existing parcel request item.
 * @param {number} parcelRequestItemId - The parcel request item ID: parcel_request_item_id
 * @param {Record<string, string>} data - The key-value data to update.
 */
export const updateParcelRequestItem = async (parcelRequestItemId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`parcel_request_item:${parcelRequestItemId}`, data);
};

/**
 * Deletes specific fields from a parcel request item.
 * @param {number} parcelRequestItemId - The parcel request item ID: parcel_request_item_id
 * @param {string[]} fields - The list of fields to delete.
 */
export const deleteParcelRequestItemFields = async (parcelRequestItemId: number, fields: string[]): Promise<void> => {
    await redisClient.hdel(`parcel_request_item:${parcelRequestItemId}`, ...fields);
};

/**
 * Creates a rate search and links it to a parcel request item.
 * @param {number} parcelRequestItemId - The parcel request item ID: parcel_request_item_id
 * @param {number} rateSearchId - The rate search ID: rate_search_id
 * @param {Record<string, string>} data - The rate search details.
 */
export const addRateSearch = async (parcelRequestItemId: number, rateSearchId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`rate_search:${rateSearchId}`, data);
    await redisClient.sadd(`parcel_request_item:${parcelRequestItemId}:rate_searches`, rateSearchId);
};

/**
 * Updates fields in an existing rate search.
 * @param {number} rateSearchId - The rate search ID: rate_search_id
 * @param {Record<string, string>} data - The key-value data to update.
 */
export const updateRateSearch = async (rateSearchId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`rate_search:${rateSearchId}`, data);
};

/**
 * Deletes specific fields from a rate search.
 * @param {number} rateSearchId - The rate search ID: rate_search_id
 * @param {string[]} fields - The list of fields to delete.
 */
export const deleteRateSearchFields = async (rateSearchId: number, fields: string[]): Promise<void> => {
    await redisClient.hdel(`rate_search:${rateSearchId}`, ...fields);
};

/**
 * Creates a rate search item and links it to a rate search.
 * @param {number} rateSearchId - The rate search ID: rate_search_id
 * @param {number} rateSearchItemId - The rate search item ID: rate_search_item_id
 * @param {Record<string, string>} data - The rate search item details.
 */
export const addRateSearchItem = async (rateSearchId: number, rateSearchItemId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`rate_search_item:${rateSearchItemId}`, data);
    await redisClient.sadd(`rate_search:${rateSearchId}:items`, rateSearchItemId);
};

/**
 * Updates fields in an existing rate search item.
 * @param {number} rateSearchItemId - The rate search item ID: rate_search_item_id
 * @param {Record<string, string>} data - The key-value data to update.
 */
export const updateRateSearchItem = async (rateSearchItemId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`rate_search_item:${rateSearchItemId}`, data);
};

/**
 * Deletes specific fields from a rate search item.
 * @param {number} rateSearchItemId - The rate search item ID: rate_search_item_id
 * @param {string[]} fields - The list of fields to delete.
 */
export const deleteRateSearchItemFields = async (rateSearchItemId: number, fields: string[]): Promise<void> => {
    await redisClient.hdel(`rate_search_item:${rateSearchItemId}`, ...fields);
};

/**
 * Retrieves all data stored in a Redis key (if it's a HASH).
 * @param {string} key - The Redis key to retrieve data from.
 * @returns {Promise<Record<string, string> | null>} - A key-value object containing all fields or `null` if key does not exist.
 */
export const getDataByKey = async (key: string): Promise<Record<string, string> | null> => {
    const data = await redisClient.hgetall(key);
    return Object.keys(data).length > 0 ? data : null;
};

/**
 * Gets the direct child IDs of a given key (e.g., parcel request items, rate searches).
 * @param {string} key - The Redis key to retrieve children from.
 * @returns {Promise<string[]>} - A list of direct child IDs.
 */
export const getDirectChildIds = async (key: string): Promise<string[]> => {
    return await redisClient.smembers(key);
};

/**
 * Recursively retrieves all nested child IDs up to a specified depth.
 * @param {string} key - The Redis key to start retrieving from.
 * @param {number} [depth=3] - The maximum depth to retrieve.
 * @returns {Promise<Record<number, string[]>>} - A record mapping depth levels to child IDs.
 */
export const getAllNestedChildIds = async (key: string, depth = 3): Promise<Record<number, string[]>> => {
    let result: Record<number, string[]> = {};
    let queue = [{ key, level: 0 }];

    while (queue.length > 0) {
        const { key, level } = queue.shift()!;
        if (level > depth) break;

        const children = await redisClient.smembers(key);
        if (children.length > 0) {
            result[level] = [...(result[level] || []), ...children];

            for (const child of children) {
                queue.push({ key: `${key.split(":")[0]}:${child}:items`, level: level + 1 });
            }
        }
    }
    return result;
};

/**
 * Retrieves the full details of all nested children using batch fetch.
 * @param {string} key - The Redis key to start retrieving from.
 * @param {number} [depth=3] - The maximum depth to retrieve.
 * @returns {Promise<Record<number, any[]>>} - A record mapping depth levels to detailed child objects.
 */
export const getAllNestedChildDetails = async (key: string, depth = 3): Promise<Record<number, any[]>> => {
    const descendants = await getAllNestedChildIds(key, depth);
    let result: Record<number, any[]> = {};

    for (const level in descendants) {
        const keys = descendants[level].map(id => `${key.split(":")[0]}:${id}`);
        const pipeline = redisClient.pipeline();

        for (const key of keys) {
            pipeline.hgetall(key);
        }

        const details = await pipeline.exec();
        result[level] = details.map(([err, data]) => data);
    }

    return result;
};
