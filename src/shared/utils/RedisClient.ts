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
    }
    catch (error) {
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
export const getParentData = async (
    itemKeys: string[],  // Mảng các itemKey
    rateSearchItemPrefix: string = "rate_search_items", // Đổi thành "rate_search_items" để lấy dữ liệu từ hash rate_search_items
    rateSearchPrefix: string = "rate_searches",
    parcelRequestPrefix: string = "parcel_request_items"
  ): Promise<Record<string, { rate_search_item: Record<string, string>, rate_search: Record<string, string>, parcel_request_item: Record<string, string> } | null>> => {
    const results: Record<string, { rate_search_item: Record<string, string>, rate_search: Record<string, string>, parcel_request_item: Record<string, string> } | null> = {};
  
    try {
      // Tạo pipeline cho các lệnh hget tất cả các itemKeys từ "rate_search_items"
      const pipeline = redisClient.pipeline();
      itemKeys.forEach((itemKey) => {
        pipeline.hget(`${rateSearchItemPrefix}:${itemKey}`, "rate_search_id");
      });
  
      // Thực thi toàn bộ các lệnh hget trong pipeline một lần
      const responses = await pipeline.exec();
  
      // Kiểm tra nếu responses là null hoặc undefined
      if (!responses) {
        throw new Error('Redis pipeline response is null or undefined');
      }
  
      // Xử lý từng phần tử trong mảng responses
      const rateSearchPromises = itemKeys.map((itemKey, index) => {
        const [error1, rateSearchId] = responses[index] as [Error | null, unknown];
  
        // Kiểm tra lỗi và đảm bảo rằng rateSearchId là một chuỗi hợp lệ
        if (error1 || !rateSearchId || typeof rateSearchId !== 'string') {
          results[itemKey] = null;
          return Promise.resolve(null); // Trả về null nếu không có rateSearchId hợp lệ
        }
  
        // Nếu rateSearchId hợp lệ, thực hiện hgetall trên "rate_searches:{rateSearchId}"
        const rateSearchKey = `${rateSearchPrefix}:${rateSearchId}`;
        return redisClient.hgetall(rateSearchKey); // Trả về promise của hgetall
      });
  
      // Đợi tất cả các promise của hgetall hoàn thành
      const rateSearchDataArray = await Promise.all(rateSearchPromises);
  
      // Xử lý kết quả và truy xuất dữ liệu từ "rate_search_items" và "parcel_request_items"
      for (let i = 0; i < itemKeys.length; i++) {
        const itemKey = itemKeys[i];
        const rateSearchData = rateSearchDataArray[i];
  
        // Kiểm tra nếu rateSearchData không hợp lệ
        if (!rateSearchData || Object.keys(rateSearchData).length === 0) {
          results[itemKey] = null;
          continue;
        }
  
        // Lấy giá trị của "parcel_request_item_id" từ "rate_searches:{rateSearchId}"
        const parcelRequestItemId = rateSearchData["parcel_request_item_id"];
  
        if (!parcelRequestItemId) {
          results[itemKey] = null;
          continue;
        }
  
        // Truy vấn "parcel_request_items:{parcelRequestItemId}"
        const parcelRequestKey = `${parcelRequestPrefix}:${parcelRequestItemId}`;
        const parcelRequestData = await redisClient.hgetall(parcelRequestKey);
  
        // Truy vấn "rate_search_items:{itemKey}" để lấy toàn bộ dữ liệu
        const rateSearchItemKey = `${rateSearchItemPrefix}:${itemKey}`;
        const rateSearchItemData = await redisClient.hgetall(rateSearchItemKey);
  
        // Tạo kết quả cho itemKey và giữ nguyên key-value
        results[itemKey] = {
          rate_search_item: rateSearchItemData,  // Lấy toàn bộ dữ liệu từ rate_search_items:{itemKey}
          rate_search: rateSearchData,           // Giữ nguyên key-value của rate_search
          parcel_request_item: parcelRequestData || {}  // Giữ nguyên key-value của parcel_request_item
        };
      }
  
      return results;  // Trả về kết quả sau khi xử lý xong
  
    } catch (error) {
      console.error(`Error in getParentData: ${error instanceof Error ? error.message : String(error)}`);
      return {};  // Đảm bảo hàm trả về giá trị hợp lệ trong trường hợp có lỗi
    }
  };
export default redisClient;
