// src/shared/utils/S3ClientManager.ts
import { S3 } from 'aws-sdk';
import { Agent } from 'https';
import config from '@configs/config';
export type { S3 } from 'aws-sdk';

export class S3ClientManager {
    private static instance: S3ClientManager | null = null;
    private client: S3 | null;
    private lastUsed: number;
    private readonly MAX_IDLE_TIME = 5 * 60 * 1000; // 5 minutes

    private constructor() {
        this.client = new S3({
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
            region: config.aws.region,
            maxRetries: 3,
            httpOptions: {
                timeout: 5000,
                connectTimeout: 5000,
                agent: new Agent({
                    maxSockets: 10
                })
            }
        });
        this.lastUsed = Date.now();
    }

    public static getInstance(): S3ClientManager {
        if (!S3ClientManager.instance) {
            S3ClientManager.instance = new S3ClientManager();
        }
        return S3ClientManager.instance;
    }

    public getClient(): S3 {
        if (!this.client) {
            this.client = new S3({
                accessKeyId: config.aws.accessKeyId,
                secretAccessKey: config.aws.secretAccessKey,
                region: config.aws.region,
                maxRetries: 3,
                httpOptions: {
                    timeout: 5000,
                    connectTimeout: 5000,
                    agent: new Agent({
                        maxSockets: 10
                    })
                }
            });
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