import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const KONG_GATEWAY_BASE_URL = process.env.KONG_GATEWAY_BASE_URL || '';
const KONG_GATEWAY_TOKEN = process.env.KONG_GATEWAY_TOKEN || '';

export const createAxiosClient = (baseURL: string = KONG_GATEWAY_BASE_URL, additionalHeaders: Record<string, string> = {}): AxiosInstance => {
    return axios.create({
        baseURL,
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${KONG_GATEWAY_TOKEN}`,
            ...additionalHeaders,
        },
    });
};

export const executeRequest = async (
    client: AxiosInstance,
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data: any = {},
    params: any = {}
): Promise<any> => {
    try {
        const config: AxiosRequestConfig = {
            method,
            url,
            data,
            params,
        };

        const response = await client.request(config);
        return response.data;
    } catch (error: any) {
        console.error(`API Request Error: ${error.message}`);
        throw new Error(`Failed to process request to ${url}: ${error.response?.data || error.message}`);
    }
};
