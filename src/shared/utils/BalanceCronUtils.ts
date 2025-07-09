import { Redis } from 'ioredis';
import { getRedisClient } from '@shared/configs/redisConfig';
import { RedisBalanceCleanupRepository, AuditCleanupConfig } from '@shared/infrastructure/repositories/RedisBalanceCleanupRepository';
import { BalanceCleanupService } from '@shared/services/BalanceCleanupService';
import { BalanceCleanupResult } from '@shared/domain/entities/BalanceCleanup';

export interface BalanceCronConfig extends AuditCleanupConfig {
    defaultCleanupDelayMinutes?: number;
    maxConcurrentCleanups?: number;
    enableLogging?: boolean;
    redisClient?: Redis;
}

export function createBalanceCleanupRepository(config: BalanceCronConfig = {}): RedisBalanceCleanupRepository {
    const redisClient = config.redisClient || getRedisClient();
    
    // Extract audit-specific configuration
    const auditConfig: AuditCleanupConfig = {
        shouldPreserveAudit: config.shouldPreserveAudit,
        auditRetentionDays: config.auditRetentionDays,
        auditArchiveBeforeCleanup: config.auditArchiveBeforeCleanup
    };
    
    return new RedisBalanceCleanupRepository(redisClient, auditConfig);
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
 * Gets statistics about active cleanup timers and audit data
 * Useful for monitoring and health checks
 */
export async function getBalanceCleanupStats(config: BalanceCronConfig = {}): Promise<{
    activeTimersCount: number;
    oldestTimerAge?: number;
    newestTimerAge?: number;
    auditStats?: {
        activeAuditKeys: number;
        archivedAuditKeys: number;
        orphanedAuditKeys: number;
    };
}> {
    try {
        const cleanupService = createBalanceCleanupService(config);
        const cleanupRepository = createBalanceCleanupRepository(config);
        
        const activeTimers = await cleanupService.getActiveTimers();
        
        let stats: any = { activeTimersCount: activeTimers.length };
        
        if (activeTimers.length > 0) {
            const now = Date.now();
            const ages = activeTimers.map(timer => now - timer.scheduledAt.getTime());
            
            stats.oldestTimerAge = Math.max(...ages);
            stats.newestTimerAge = Math.min(...ages);
        }
        
        // Get audit statistics
        try {
            stats.auditStats = await cleanupRepository.getAuditCleanupStats();
        } catch (auditError) {
            console.error('Failed to get audit stats:', auditError);
        }
        
        return stats;
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
    auditHealth?: {
        orphanedAuditKeys: number;
        warningThreshold: number;
    };
}> {
    try {
        const stats = await getBalanceCleanupStats(config);
        const orphanedCount = stats.auditStats?.orphanedAuditKeys || 0;
        const warningThreshold = 100; // Alert if more than 100 orphaned audit keys
        
        const isHealthy = orphanedCount < warningThreshold;
        const message = isHealthy 
            ? `Balance cleanup system is healthy. Active timers: ${stats.activeTimersCount}, Orphaned audit keys: ${orphanedCount}`
            : `Balance cleanup system has issues. Active timers: ${stats.activeTimersCount}, Orphaned audit keys: ${orphanedCount} (exceeds threshold of ${warningThreshold})`;
        
        return {
            isHealthy,
            activeTimers: stats.activeTimersCount,
            message,
            auditHealth: {
                orphanedAuditKeys: orphanedCount,
                warningThreshold
            }
        };
    } catch (error) {
        return {
            isHealthy: false,
            activeTimers: 0,
            message: `Balance cleanup system unhealthy: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}

// Cron job utilities
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