import { Redis } from 'ioredis';
import { getRedisClient } from '@shared/configs/redisConfig';
import { RedisBalanceRepository } from '@shared/infrastructure/redis/RedisBalanceRepository';
import { BalanceService, BalanceServiceConfig } from '@shared/services/BalanceService';

export class BalanceFactory {
    private static redisClient: Redis | null = null;
    private static repository: RedisBalanceRepository | null = null;
    private static service: BalanceService | null = null;



    static getRedisClient(): Redis {
        if (!this.redisClient) {
            this.redisClient = getRedisClient();
        }
        return this.redisClient;
    }


    static getBalanceRepository(): RedisBalanceRepository {
        if (!this.repository) {
            const redis = this.getRedisClient();
            this.repository = new RedisBalanceRepository(redis);
        }
        return this.repository;
    }


    static getBalanceService(config?: BalanceServiceConfig): BalanceService {
        if (!this.service) {
            const repository = this.getBalanceRepository();
            this.service = new BalanceService(repository, config);
        }
        return this.service;
    }




    static createCustomInstance(
        redis?: Redis,
        serviceConfig?: BalanceServiceConfig
    ): {
        repository: RedisBalanceRepository;
        service: BalanceService;
    } {
        const redisClient = redis || this.getRedisClient();
        const repository = new RedisBalanceRepository(redisClient);
        const service = new BalanceService(repository, serviceConfig);

        return {
            repository,
            service
        };
    }


    static reset(): void {
        this.redisClient = null;
        this.repository = null;
        this.service = null;

    }


    static async healthCheck(): Promise<{
        redis: boolean;
        repository: boolean;
        service: boolean;
        timestamp: Date;
    }> {
        const timestamp = new Date();
        let redis = false;
        let repository = false;
        let service = false;

        try {
            const redisClient = this.getRedisClient();
            await redisClient.ping();
            redis = true;

            const repo = this.getBalanceRepository();
            await repo.exists('health_check_user');
            repository = true;

            this.getBalanceService();
            service = true;

        } catch (error) {
            console.error('Balance system health check failed:', error);
        }

        return {
            redis,
            repository,
            service,
            timestamp
        };
    }
}




export function getBalanceService(config?: BalanceServiceConfig): BalanceService {
    return BalanceFactory.getBalanceService(config);
}


export const PRODUCTION_CONFIG: BalanceServiceConfig = {
    maxRetries: 3,
    retryDelayMs: 100,
    defaultCreditLimit: 0
};


export const DEVELOPMENT_CONFIG: BalanceServiceConfig = {
    maxRetries: 1,
    retryDelayMs: 50,
    defaultCreditLimit: 1000
};
