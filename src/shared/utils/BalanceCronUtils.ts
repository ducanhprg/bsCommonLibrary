import { Redis } from 'ioredis';
import { getRedisClient } from '@shared/configs/redisConfig';
import { RedisBalanceCleanupRepository } from '@shared/infrastructure/repositories/RedisBalanceCleanupRepository';
import { BalanceCleanupService } from '@shared/services/BalanceCleanupService';
import { BalanceCleanupResult } from '@shared/domain/entities/BalanceCleanup';
import { BalanceRepositoryInterface } from '@shared/domain/interfaces/BalanceRepositoryInterface';
import { RedisBalanceRepository } from '@shared/infrastructure/redis/RedisBalanceRepository';

export interface BalanceCronConfig {
    defaultCleanupDelayMinutes?: number;
    maxConcurrentCleanups?: number;
    enableLogging?: boolean;
    redisClient?: Redis;
    balanceRepository?: BalanceRepositoryInterface;
    tenantDatabaseName?: string;
}

export function createBalanceCleanupRepository(config: BalanceCronConfig = {}): RedisBalanceCleanupRepository {
    const redisClient = config.redisClient || new Redis(); // Use provided Redis client or create new one
    
    // Use provided balance repository or create a new one
    const balanceRepository = config.balanceRepository || new RedisBalanceRepository(redisClient);
    
    return new RedisBalanceCleanupRepository(
        redisClient,
        balanceRepository,
        config.tenantDatabaseName
    );
}

/**
 * Creates a configured balance cleanup service instance
 * This function is designed to be used by cron services
 */
export function createBalanceCleanupService(config: BalanceCronConfig = {}): BalanceCleanupService {
    const cleanupRepository = createBalanceCleanupRepository(config);

    return new BalanceCleanupService(cleanupRepository, {
        defaultCleanupDelayMinutes: config.defaultCleanupDelayMinutes,
        maxConcurrentCleanups: config.maxConcurrentCleanups,
        enableLogging: config.enableLogging
    });
}

/**
 * Executes balance cleanup for expired timers
 * This is the main function to be called by cron jobs
 */
export async function executeBalanceCleanupCron(config: BalanceCronConfig = {}): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    results: BalanceCleanupResult[];
    executionTime: number;
}> {
    const startTime = Date.now();
    let cleanupService: BalanceCleanupService | null = null;
    
    try {
        cleanupService = createBalanceCleanupService(config);
        
        const results = await cleanupService.executeExpiredCleanups();
        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;
        
        const executionTime = Date.now() - startTime;
        
        return {
            totalProcessed: results.length,
            successful,
            failed,
            results,
            executionTime
        };
    } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        console.error(`[BalanceCronUtils] Cleanup cron job failed: ${errorMessage}`);
        
        return {
            totalProcessed: 0,
            successful: 0,
            failed: 1,
            results: [],
            executionTime
        };
    }
}

/**
 * Gets statistics about active cleanup timers
 * Useful for monitoring and health checks
 */
export async function getBalanceCleanupStats(config: BalanceCronConfig = {}): Promise<{
    activeTimersCount: number;
    oldestTimerAge?: number;
    newestTimerAge?: number;
}> {
    try {
        const cleanupService = createBalanceCleanupService(config);
        const activeTimers = await cleanupService.getActiveTimers();
        
        if (activeTimers.length === 0) {
            return { activeTimersCount: 0 };
        }
        
        const now = Date.now();
        const ages = activeTimers.map(timer => now - timer.scheduledAt.getTime());
        
        return {
            activeTimersCount: activeTimers.length,
            oldestTimerAge: Math.max(...ages),
            newestTimerAge: Math.min(...ages)
        };
    } catch (error) {
        console.error(`[BalanceCronUtils] Failed to get cleanup stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return { activeTimersCount: 0 };
    }
}

/**
 * Health check function for balance cleanup system
 */
export async function balanceCleanupHealthCheck(config: BalanceCronConfig = {}): Promise<{
    isHealthy: boolean;
    activeTimers: number;
    message: string;
}> {
    try {
        const stats = await getBalanceCleanupStats(config);
        
        return {
            isHealthy: true,
            activeTimers: stats.activeTimersCount,
            message: `Balance cleanup system is healthy. Active timers: ${stats.activeTimersCount}`
        };
    } catch (error) {
        return {
            isHealthy: false,
            activeTimers: 0,
            message: `Balance cleanup system unhealthy: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}

// Enhanced factory function for complete balance service setup
export function createBalanceServiceWithCleanup(
    balanceRepository: BalanceRepositoryInterface,
    config: BalanceCronConfig & {
        maxRetries?: number;
        retryDelayMs?: number;
        defaultCreditLimit?: number;
        cleanupRetryDelayMs?: number;
    } = {}
): { balanceService: any; cleanupService: BalanceCleanupService } {
    const { BalanceService } = require('@shared/services/BalanceService');
    
    const cleanupService = createBalanceCleanupService({
        ...config,
        balanceRepository // Pass the same repository for seamless integration
    });

    const balanceService = new BalanceService(
        balanceRepository,
        {
            maxRetries: config.maxRetries,
            retryDelayMs: config.retryDelayMs,
            defaultCreditLimit: config.defaultCreditLimit,
            cleanupRetryDelayMs: config.cleanupRetryDelayMs
        },
        undefined, // tenantDatabasePrefix
        config.tenantDatabaseName,
        cleanupService
    );

    return { balanceService, cleanupService };
}

// Cron job utilities (keeping existing functionality)
let cleanupService: BalanceCleanupService | null = null;

export async function startBalanceCleanupCron(config: BalanceCronConfig = {}): Promise<void> {
    if (!cleanupService) {
        cleanupService = createBalanceCleanupService(config);
    }

    // Run cleanup every 5 minutes
    const interval = setInterval(async () => {
        try {
            await cleanupService?.executeExpiredCleanups();
        } catch (error) {
            console.error('Error during balance cleanup cron:', error);
        }
    }, 5 * 60 * 1000); // 5 minutes

    // Handle process termination
    process.on('SIGTERM', () => {
        console.log('Stopping balance cleanup cron...');
        clearInterval(interval);
        process.exit(0);
    });

    process.on('SIGINT', () => {
        console.log('Stopping balance cleanup cron...');
        clearInterval(interval);
        process.exit(0);
    });

    console.log('Balance cleanup cron started. Running every 5 minutes.');
}

export async function stopBalanceCleanupCron(): Promise<void> {
    cleanupService = null;
    console.log('Balance cleanup cron stopped.');
}

export async function runBalanceCleanupOnce(config: BalanceCronConfig = {}): Promise<void> {
    const cleanupService = createBalanceCleanupService(config);
    
    try {
        const results = await cleanupService.executeExpiredCleanups();
        console.log(`Cleanup completed. Processed ${results.length} accounts.`);
    } catch (error) {
        console.error('Error during one-time balance cleanup:', error);
        throw error;
    }
} 