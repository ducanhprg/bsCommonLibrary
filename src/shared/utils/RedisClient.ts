import { getRedisClient, getRedisSubClient } from "@shared/configs/redisConfig";

const redisClient = getRedisClient();
const redisAdminClient = getRedisSubClient();
/**
 * Stores a simple key-value pair in Redis with an optional expiration time.
 * @param {string} key - The Redis key to store.
 * @param {string} value - The value to store.
 * @param {number} [ttl=3600] - The time-to-live (TTL) in seconds (default is 1 hour).
 * @returns {Promise<void>}
 */
export const setDataByKey = async (
  key: string,
  value: string,
  ttl: number = 3600
): Promise<void> => {
  await redisClient.set(key, value, "EX", ttl);
};

/**
 * Stores multiple fields in a Redis HASH.
 * @param {string} key - The Redis HASH key.
 * @param {Record<string, string>} data - The key-value data to store in the HASH.
 * @returns {Promise<void>}
 */
export const setDataByHashKey = async (
  key: string,
  data: Record<string, string>
): Promise<void> => {
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
export const waitForKey = async (
  key: string,
  timeout = 10000,
  interval = 100
): Promise<string | null> => {
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
export const waitForHashKeyField = async (
  key: string,
  field: string,
  timeout = 10000,
  interval = 100
): Promise<string | null> => {
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
export const getDataByHashKey = async (
  key: string
): Promise<Record<string, string> | null> => {
  const data = await redisClient.hgetall(key);
  return Object.keys(data).length > 0 ? data : null;
};

/**
 * Retrieves specific fields from a Redis HASH.
 * @param {string} key - The Redis key (must be a HASH).
 * @param {string[]} fields - The list of fields to retrieve.
 * @returns {Promise<Record<string, string> | null>} - A key-value object with requested fields, or `null` if no fields exist.
 */
export const getFieldsByHashKey = async (
  key: string,
  fields: string[]
): Promise<Record<string, string> | null> => {
  const values = await redisClient.hmget(key, ...fields);

  if (!values.some((value) => value !== null)) return null; // Check if all values are null

  return fields.reduce((acc, field, index) => {
    if (values[index] !== null) acc[field] = values[index]!;
    return acc;
  }, {} as Record<string, string>);
};

/**
 
 * @param {string} key
 * @param {number} batchSize 
 */
export const sscanKeys = async (
  key: string,
  batchSize: number = 100
): Promise<string[]> => {
  let cursor = "0";
  let members: string[] = [];

  do {
    const [nextCursor, batch] = await redisClient.sscan(
      key,
      cursor,
      "COUNT",
      batchSize
    );
    cursor = nextCursor;
    members.push(...batch);
  } while (cursor !== "0");

  return members;
};

/**
 *
 * @param {string} field
 */
export const getHashFieldValue = async (
  hashKey: string,
  field: string
): Promise<string | null> => {
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
      console.log(
        `✅ Found value for '${field}' in Hash '${hashKey}': ${value}`
      );
    }
    return value;
  } catch (error) {
    console.error(
      `❌ Error fetching field '${field}' from Hash '${hashKey}':`,
      error
    );
    return null;
  }
};

/**
 * @param {string} hashKey
 * @param {Record<string, any>} fields
 */
export const updateOrCreateHashFields = async (
  hashKey: string,
  fields: Record<string, any>
) => {
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
    console.error(
      `❌ Error updating/creating Hash fields in ${hashKey}:`,
      error
    );
  }
};
/**
 *
 * @param {string} key
 * @param {string[]} fields
 */
export const getMultipleHashFields = async (
  key: string,
  fields: string[]
): Promise<(string | null)[]> => {
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
export const addMembersToSet = async (
  setKey: string,
  members: string[]
): Promise<void> => {
  if (members.length === 0) return;
  await redisClient.sadd(setKey, ...members);
  console.log(`✅ Added ${members.length} members to SET: ${setKey}`);
};

/**
 *
 * @param {Record<string, Record<string, string>>} hashData
 */
export const createHashForMembers = async (
  hashData: Record<string, Record<string, any>>
): Promise<void> => {
  const pipeline = redisClient.pipeline();

  Object.entries(hashData).forEach(([key, fields]) => {
    pipeline.hmset(key, fields);
  });

  await pipeline.exec();
};

/**
 *
 * @param {string} setKey
 * @param {string} value
 * @returns {Promise<boolean>}
 */
export const isMemberInSet = async (
  setKey: string,
  value: string
): Promise<boolean> => {
  try {
    const result = await redisClient.sismember(setKey, value);
    return result === 1;
  } catch (error) {
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
    console.log(
      `📢 [PUBLISH] Sent message: "${message}" to channel "${channel}"`
    );
  } catch (error) {
    console.error("Error publishing message:", error);
  }
};

interface RedisHashData {
  [key: string]: string | null;
}

interface ParentData {
  rate_search_item: RedisHashData;
  rate_search: RedisHashData;
  parcel_request_item: RedisHashData;
}

const fetchRateSearchIds = async (
  itemKeys: string[],
  prefix: string
): Promise<(string | null)[]> => {
  const pipeline = redisClient.pipeline();
  itemKeys.forEach((itemKey) =>
    pipeline.hget(`${prefix}:${itemKey}`, "rate_search_id")
  );
  const responses = await pipeline.exec();
  return (
    responses?.map(([error, result]) =>
      error || !result || typeof result !== "string" ? null : (result as string)
    ) || []
  );
};

const fetchBatchData = async (keys: string[]): Promise<RedisHashData[]> => {
  if (!keys.length) return [];
  const pipeline = redisClient.pipeline();
  keys.forEach((key) => pipeline.hgetall(key));
  const responses = await pipeline.exec();
  return (
    responses?.map(([error, data]) =>
      error || !data ? {} : (data as RedisHashData)
    ) || []
  );
};

export const getParentData = async (
  itemKeys: string[],
  rateSearchItemPrefix: string = "rate_search_items",
  rateSearchPrefix: string = "rate_searches",
  parcelRequestPrefix: string = "parcel_request_items"
): Promise<Record<string, ParentData | null>> => {
  if (!itemKeys.length) return {};

  const results: Record<string, ParentData | null> = {};

  try {
    const rateSearchIds = await fetchRateSearchIds(
      itemKeys,
      rateSearchItemPrefix
    );
    const rateSearchKeys = rateSearchIds
      .map((id, i) => (id ? `${rateSearchPrefix}:${id}` : null))
      .filter(Boolean) as string[];
    const rateSearchItemKeys = itemKeys.map(
      (key) => `${rateSearchItemPrefix}:${key}`
    );

    const [rateSearchDataArray, rateSearchItemDataArray] = await Promise.all([
      fetchBatchData(rateSearchKeys),
      fetchBatchData(rateSearchItemKeys),
    ]);

    const parcelRequestKeys = rateSearchDataArray
      .map((data) => {
        const id = data["parcel_request_item_id"];
        return id ? `${parcelRequestPrefix}:${id}` : null;
      })
      .filter(Boolean) as string[];

    const parcelDataArray = await fetchBatchData(parcelRequestKeys);

    let parcelIndex = 0;
    itemKeys.forEach((itemKey, index) => {
      if (!rateSearchIds[index]) {
        results[itemKey] = null;
        return;
      }

      const rateSearchData = rateSearchDataArray[index];
      const rateSearchItemData = rateSearchItemDataArray[index];
      const parcelData = rateSearchData["parcel_request_item_id"]
        ? parcelDataArray[parcelIndex++]
        : {};

      results[itemKey] =
        rateSearchData && Object.keys(rateSearchData).length > 0
          ? {
              rate_search_item: rateSearchItemData,
              rate_search: rateSearchData,
              parcel_request_item: parcelData,
            }
          : null;
    });

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error in getParentData: ${errorMessage}`);
    throw new Error(`Failed to fetch parent data: ${errorMessage}`);
  }
};

const fetchRateSearchByParcelId = async (
  parcelIds: string[],
  rateSearchPrefix: string
): Promise<(string | null)[]> => {
  if (!parcelIds.length) return [];
  
  // We need to scan through rate_searches to find ones with matching parcel_request_item_id
  const rateSearchIds: (string | null)[] = [];
  
  for (const parcelId of parcelIds) {
    let found = false;
    let cursor = "0";
    
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        "MATCH",
        `${rateSearchPrefix}:*`,
        "COUNT",
        100
      );
      cursor = nextCursor;
      
      if (keys.length > 0) {
        const pipeline = redisClient.pipeline();
        keys.forEach(key => pipeline.hget(key, "parcel_request_item_id"));
        const responses = await pipeline.exec();
        
        for (let i = 0; i < keys.length; i++) {
          const [error, result] = responses![i];
          if (!error && result === parcelId) {
            // Extract the ID from the key (remove prefix)
            const rateSearchId = keys[i].replace(`${rateSearchPrefix}:`, "");
            rateSearchIds.push(rateSearchId);
            found = true;
            break;
          }
        }
      }
      
      if (found) break;
    } while (cursor !== "0");
    
    if (!found) {
      rateSearchIds.push(null);
    }
  }
  
  return rateSearchIds;
};

const fetchRateSearchItemsByRateSearchId = async (
  rateSearchIds: (string | null)[],
  rateSearchItemPrefix: string
): Promise<(string | null)[]> => {
  if (!rateSearchIds.length) return [];
  
  const rateSearchItemIds: (string | null)[] = [];
  
  for (const rateSearchId of rateSearchIds) {
    if (!rateSearchId) {
      rateSearchItemIds.push(null);
      continue;
    }
    
    let found = false;
    let cursor = "0";
    
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        "MATCH",
        `${rateSearchItemPrefix}:*`,
        "COUNT",
        100
      );
      cursor = nextCursor;
      
      if (keys.length > 0) {
        const pipeline = redisClient.pipeline();
        keys.forEach(key => pipeline.hget(key, "rate_search_id"));
        const responses = await pipeline.exec();
        
        for (let i = 0; i < keys.length; i++) {
          const [error, result] = responses![i];
          if (!error && result === rateSearchId) {
            // Extract the ID from the key (remove prefix)
            const rateSearchItemId = keys[i].replace(`${rateSearchItemPrefix}:`, "");
            rateSearchItemIds.push(rateSearchItemId);
            found = true;
            break;
          }
        }
      }
      
      if (found) break;
    } while (cursor !== "0");
    
    if (!found) {
      rateSearchItemIds.push(null);
    }
  }
  
  return rateSearchItemIds;
};

export const getParentDataByParcelId = async (
  parcelIds: string[],
  rateSearchItemPrefix: string = "rate_search_items",
  rateSearchPrefix: string = "rate_searches", 
  parcelRequestPrefix: string = "parcel_request_items"
): Promise<Record<string, ParentData | null>> => {
  if (!parcelIds.length) return {};

  const results: Record<string, ParentData | null> = {};

  try {
    // First, get parcel request item data
    const parcelRequestKeys = parcelIds.map(id => `${parcelRequestPrefix}:${id}`);
    const parcelDataArray = await fetchBatchData(parcelRequestKeys);

    // Find rate searches that reference these parcel IDs
    const rateSearchIds = await fetchRateSearchByParcelId(parcelIds, rateSearchPrefix);
    
    // Get rate search data
    const rateSearchKeys = rateSearchIds
      .map(id => id ? `${rateSearchPrefix}:${id}` : null)
      .filter(Boolean) as string[];
    const rateSearchDataArray = await fetchBatchData(rateSearchKeys);

    // Find rate search items that reference these rate search IDs
    const rateSearchItemIds = await fetchRateSearchItemsByRateSearchId(rateSearchIds, rateSearchItemPrefix);
    
    // Get rate search item data
    const rateSearchItemKeys = rateSearchItemIds
      .map(id => id ? `${rateSearchItemPrefix}:${id}` : null)
      .filter(Boolean) as string[];
    const rateSearchItemDataArray = await fetchBatchData(rateSearchItemKeys);

    // Build results
    let rateSearchIndex = 0;
    let rateSearchItemIndex = 0;
    
    parcelIds.forEach((parcelId, index) => {
      const parcelData = parcelDataArray[index];
      const rateSearchId = rateSearchIds[index];
      const rateSearchItemId = rateSearchItemIds[index];
      
      let rateSearchData = {};
      let rateSearchItemData = {};
      
      if (rateSearchId) {
        rateSearchData = rateSearchDataArray[rateSearchIndex++] || {};
      }
      
      if (rateSearchItemId) {
        rateSearchItemData = rateSearchItemDataArray[rateSearchItemIndex++] || {};
      }

      results[parcelId] = 
        Object.keys(parcelData).length > 0
          ? {
              rate_search_item: rateSearchItemData,
              rate_search: rateSearchData,
              parcel_request_item: parcelData,
            }
          : null;
    });

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error in getParentDataByParcelId: ${errorMessage}`);
    throw new Error(`Failed to fetch parent data by parcel ID: ${errorMessage}`);
  }
};

/**
 *
 * @param {string} channel
 * @param {string} expectedMessage
 * @param {number} timeout
 * @returns {Promise<string>}
 */
export const listenForMessage = async (
  channel: string,
  expectedMessage: string,
  timeout: number = 5000
): Promise<any> => {
  return new Promise((resolve, reject) => {
    let isResolved = false;

    const timer = setTimeout(() => {
      if (!isResolved) {
        reject(
          new Error(
            `⏳ Timeout: Không nhận được message "${expectedMessage}" từ ${channel} sau ${timeout}ms`
          )
        );
      }
    }, timeout);

    const messageHandler = (receivedChannel: string, message: string) => {
      if (receivedChannel === channel && message === expectedMessage) {
        clearTimeout(timer);
        isResolved = true;
        redisAdminClient.off("message", messageHandler);
        console.log(`📩 Received message: "${message}"`);
        resolve(message);
      }
    };

    redisAdminClient.subscribe(channel, (err, count) => {
      if (err) {
        clearTimeout(timer);
        reject(new Error(`❌ Lỗi khi subscribe Redis: ${err.message}`));
      } else {
        console.log(
          `👂 Listening on Redis channel: ${channel} (Expecting: "${expectedMessage}")`
        );
        redisAdminClient.on("message", messageHandler);
      }
    });
  });
};

export const setToRedis = async (key: string, items: any): Promise<void> => {
  const pipeline = redisClient.pipeline();
  for (const item of items) {
    pipeline.zadd(key, item.score, JSON.stringify(item.value));
  }
  await pipeline.exec();
};

/**
   
   * @param {string} key
   * @param {number} batchSize 
   */
export const getFromRedis = async (key: string): Promise<string[]> => {
  const rawItems = await redisClient.zrange(key, 0, -1);
  return rawItems.map((item) => JSON.parse(item));
};

/**
 *
 * @param {string} key
 * @param {number} [timeout=5000]
 * @param {number} [interval=50]
 * @returns {Promise<string | null>}
 */
export const getKeyPolling = async (
  key: string,
  timeout: number = 5000,
  interval: number = 50
): Promise<string | null> => {
  const startTime = Date.now();
  const lockKey = `lock:${key}`;

  while (Date.now() - startTime < timeout) {
    const pipeline = redisClient.pipeline();
    pipeline.get(key);
    pipeline.get(lockKey);

    const responses = await pipeline.exec();

    if (!responses || responses.length < 2) {
      return null;
    }

    const getResult = responses[0];
    const lockResult = responses[1];

    const value = getResult[1] as string | null;
    const lock = lockResult[1] as string | null;

    if (value !== null) {
      return value;
    }

    if (!lock) {
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return null;
};

export const setKeyPoling = async (
  key: string,
  value: string,
  ttl: number = 3600
): Promise<void> => {
  const lockKey = `lock:${key}`;
  const LOCK_EXPIRY = 10;

  const lockAcquired = await redisClient.set(
    lockKey,
    "1",
    "EX",
    LOCK_EXPIRY,
    "NX"
  );

  if (!lockAcquired) {
    return;
  }

  try {
    await redisClient.set(key, value, "EX", ttl);
  } catch (error) {
  } finally {
    await redisClient.del(lockKey);
  }
};

/**
 *
 * @param {string} setKey
 * @returns {Promise<string[]>}
 */
export const getSetMembers = async (setKey: string): Promise<string[]> => {
  try {
    const members = await redisClient.smembers(setKey);
    return members || [];
  } catch (error) {
    return [];
  }
};

export const incrementHashField = async (
  hashKey: string,
  field: string = "current",
  value: number = 1
): Promise<number> => {
  try {
    console.log(`🔄 Incrementing hash field: ${hashKey} - ${field} - ${value}`);
    const newValue = await redisClient.hincrby(hashKey, field, value);
    return newValue;
  } catch (error) {
    console.error("Error incrementing hash field:", error);
    throw error;
  }
};

export const deleteCacheByPrefixes = async (
  prefixes: string[]
): Promise<void> => {
  if (!prefixes || prefixes.length === 0) return;

  const pipeline = redisClient.pipeline();

  for (const prefix of prefixes) {
    const pattern = `${prefix}:*`;
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        1000
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        pipeline.del(...keys);
      }
    } while (cursor !== "0");
  }

  await pipeline.exec();
};
export default redisClient;
