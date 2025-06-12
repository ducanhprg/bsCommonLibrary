// src/shared/utils/S3ClientManager.ts
import { S3 } from 'aws-sdk';
import { Agent } from 'https';
import config from '@shared/configs/awsConfig';
export type { S3 } from 'aws-sdk';

// Default values for S3 configuration
const DEFAULT_S3_CONFIG = {
    maxRetries: 3,
    timeout: 5000,
    connectTimeout: 5000,
    maxSockets: 10,
    maxIdleTime: 300000, // 5 minutes in milliseconds
    region: 'us-east-1',
    accessKeyId: 'dummy-access-key',
    secretAccessKey: 'dummy-secret-key'
};

export class S3ClientManager {
    private static instance: S3ClientManager | null = null;
    private client: S3 | null;
    private lastUsed: number;
    private readonly MAX_IDLE_TIME: number;

    private constructor() {
        this.MAX_IDLE_TIME = config?.s3?.maxIdleTime ?? DEFAULT_S3_CONFIG.maxIdleTime;
        this.client = this.createS3Client();
        this.lastUsed = Date.now();
    }

    private createS3Client(): S3 {
        const s3Config = {
            accessKeyId: config?.accessKeyId || DEFAULT_S3_CONFIG.accessKeyId,
            secretAccessKey: config?.secretAccessKey || DEFAULT_S3_CONFIG.secretAccessKey,
            region: config?.region || DEFAULT_S3_CONFIG.region,
            maxRetries: config?.s3?.maxRetries ?? DEFAULT_S3_CONFIG.maxRetries,
            httpOptions: {
                timeout: config?.s3?.timeout ?? DEFAULT_S3_CONFIG.timeout,
                connectTimeout: config?.s3?.connectTimeout ?? DEFAULT_S3_CONFIG.connectTimeout,
                agent: new Agent({
                    maxSockets: config?.s3?.maxSockets ?? DEFAULT_S3_CONFIG.maxSockets
                })
            }
        };

        if (!config?.accessKeyId || !config?.secretAccessKey) {
            console.warn('S3ClientManager: Using default configuration values. This is not recommended for production use.');
        }

        return new S3(s3Config);
    }

    public static getInstance(): S3ClientManager {
        if (!S3ClientManager.instance) {
            S3ClientManager.instance = new S3ClientManager();
        }
        return S3ClientManager.instance;
    }

    public getClient(): S3 {
        if (!this.client) {
            this.client = this.createS3Client();
        }
        this.lastUsed = Date.now();
        return this.client;
    }

    public cleanup() {
        if (Date.now() - this.lastUsed > this.MAX_IDLE_TIME) {
            this.client = null;
            S3ClientManager.instance = null;
        }
    }
}