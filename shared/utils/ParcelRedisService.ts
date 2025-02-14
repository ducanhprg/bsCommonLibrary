import redisClient from './RedisClient';

// 📌 Create Parcel Request
export const createParcelRequest = async (parcelRequestId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`parcel_request:${parcelRequestId}`, data);
};

// 📌 Update Parcel Request (Add/Modify Fields)
export const updateParcelRequest = async (parcelRequestId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`parcel_request:${parcelRequestId}`, data);
};

// 📌 Delete Specific Fields in Parcel Request
export const deleteParcelRequestFields = async (parcelRequestId: number, fields: string[]): Promise<void> => {
    await redisClient.hdel(`parcel_request:${parcelRequestId}`, ...fields);
};

// 📌 Link Parcel Request Item to Parcel Request
export const addParcelRequestItem = async (parcelRequestId: number, parcelRequestItemId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`parcel_request_item:${parcelRequestItemId}`, data);
    await redisClient.sadd(`parcel_request:${parcelRequestId}:items`, parcelRequestItemId);
};

// 📌 Update Parcel Request Item (Add/Modify Fields)
export const updateParcelRequestItem = async (parcelRequestItemId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`parcel_request_item:${parcelRequestItemId}`, data);
};

// 📌 Delete Specific Fields in Parcel Request Item
export const deleteParcelRequestItemFields = async (parcelRequestItemId: number, fields: string[]): Promise<void> => {
    await redisClient.hdel(`parcel_request_item:${parcelRequestItemId}`, ...fields);
};

// 📌 Create Rate Search and Link to Parcel Request Item
export const addRateSearch = async (rateSearchId: number, parcelRequestItemId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`rate_search:${rateSearchId}`, data);
    await redisClient.sadd(`parcel_request_item:${parcelRequestItemId}:rate_searches`, rateSearchId);
};

// 📌 Update Rate Search (Add/Modify Fields)
export const updateRateSearch = async (rateSearchId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`rate_search:${rateSearchId}`, data);
};

// 📌 Delete Specific Fields in Rate Search
export const deleteRateSearchFields = async (rateSearchId: number, fields: string[]): Promise<void> => {
    await redisClient.hdel(`rate_search:${rateSearchId}`, ...fields);
};

// 📌 Create Rate Search Item and Link to Rate Search
export const addRateSearchItem = async (rateSearchItemId: number, rateSearchId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`rate_search_item:${rateSearchItemId}`, data);
    await redisClient.sadd(`rate_search:${rateSearchId}:items`, rateSearchItemId);
};

// 📌 Update Rate Search Item (Add/Modify Fields)
export const updateRateSearchItem = async (rateSearchItemId: number, data: Record<string, string>): Promise<void> => {
    await redisClient.hmset(`rate_search_item:${rateSearchItemId}`, data);
};

// 📌 Delete Specific Fields in Rate Search Item
export const deleteRateSearchItemFields = async (rateSearchItemId: number, fields: string[]): Promise<void> => {
    await redisClient.hdel(`rate_search_item:${rateSearchItemId}`, ...fields);
};

// 📌 Retrieve Parcel Request from Rate Search Item ID
export const getParcelRequestFromRateSearchItem = async (rateSearchItemId: number): Promise<Record<string, number> | null> => {
    const rateSearchId = await redisClient.hget(`rate_search_item:${rateSearchItemId}`, "rate_search_id");
    if (!rateSearchId) return null;

    const parcelRequestItemId = await redisClient.hget(`rate_search:${rateSearchId}`, "parcel_request_item_id");
    if (!parcelRequestItemId) return null;

    const parcelRequestId = await redisClient.hget(`parcel_request_item:${parcelRequestItemId}`, "parcel_request_id");
    if (!parcelRequestId) return null;

    return { rateSearchItemId, rateSearchId: Number(rateSearchId), parcelRequestItemId: Number(parcelRequestItemId), parcelRequestId: Number(parcelRequestId) };
};
