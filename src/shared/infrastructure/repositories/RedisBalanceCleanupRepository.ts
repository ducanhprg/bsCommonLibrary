import { Redis } from 'ioredis';
import { BalanceCleanupRepositoryInterface } from '@shared/domain/interfaces/BalanceCleanupRepositoryInterface';
import { BalanceCleanupTimer, BalanceCleanupResult, BalanceCleanupError } from '@shared/domain/entities/BalanceCleanup';
import { BalanceRepositoryInterface } from '@shared/domain/interfaces/BalanceRepositoryInterface';
import { BalanceUtilityService } from '@shared/services/BalanceUtilityService';

export class RedisBalanceCleanupRepository implements BalanceCleanupRepositoryInterface {
    private readonly CLEANUP_TIMER_PREFIX = 'balance_cleanup_timer';
    private readonly CLEANUP_LOCK_PREFIX = 'balance_cleanup_lock';
    private readonly BALANCE_KEYS = [
        'current_balance',
        'available_balance', 
        'credit_limit',
        'total_fund_available',
        'pending_transaction_amount'
    ];
    private readonly LOCK_TIMEOUT_MS = 5000; // Shorter timeout (5 seconds) to avoid blocking balance operations
    private readonly CLEANUP_RETRY_DELAY_MS = 2000; // 2 seconds delay before retry
    private readonly MAX_CLEANUP_RETRIES = 3; // Maximum retry attempts for cleanup

    constructor(
        private readonly redisClient: Redis,
        private readonly balanceRepository?: BalanceRepositoryInterface,
        private readonly tenantDatabaseName?: string
    ) {}

    async scheduleCleanup(dbprefix: string, delayMinutes: number): Promise<void> {
        try {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + delayMinutes * 60 * 1000);
            
            const timer: BalanceCleanupTimer = {
                dbprefix,
                scheduledAt: now,
                expiresAt,
                isActive: true
            };

            await this.storeCleanupTimer(timer);
        } catch (error) {
            throw new BalanceCleanupError(
                `Failed to schedule cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`,
                dbprefix
            );
        }
    }

    async resetCleanupTimer(dbprefix: string, delayMinutes: number): Promise<void> {
        try {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + delayMinutes * 60 * 1000);
            
            const timer: BalanceCleanupTimer = {
                dbprefix,
                scheduledAt: now,
                expiresAt,
                isActive: true,
                lastResetAt: now
            };

            await this.storeCleanupTimer(timer);
        } catch (error) {
            throw new BalanceCleanupError(
                `Failed to reset cleanup timer: ${error instanceof Error ? error.message : 'Unknown error'}`,
                dbprefix
            );
        }
    }

    async getExpiredCleanupTimers(): Promise<BalanceCleanupTimer[]> {
        try {
            const pattern = `${this.CLEANUP_TIMER_PREFIX}:*`;
            const keys = await this.scanKeys(pattern);
            const now = new Date();
            const expiredTimers: BalanceCleanupTimer[] = [];

            for (const key of keys) {
                const timer = await this.getCleanupTimer(key);
                if (timer && timer.isActive && timer.expiresAt <= now) {
                    expiredTimers.push(timer);
                }
            }

            return expiredTimers;
        } catch (error) {
            throw new BalanceCleanupError(
                `Failed to get expired cleanup timers: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async getActiveCleanupTimers(): Promise<BalanceCleanupTimer[]> {
        try {
            const pattern = `${this.CLEANUP_TIMER_PREFIX}:*`;
            const keys = await this.scanKeys(pattern);
            const activeTimers: BalanceCleanupTimer[] = [];

            for (const key of keys) {
                const timer = await this.getCleanupTimer(key);
                if (timer && timer.isActive) {
                    activeTimers.push(timer);
                }
            }

            return activeTimers;
        } catch (error) {
            throw new BalanceCleanupError(
                `Failed to get active cleanup timers: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async executeCleanup(dbprefix: string): Promise<BalanceCleanupResult> {
        return await this.executeCleanupWithRetry(dbprefix, 0);
    }

    private async executeCleanupWithRetry(dbprefix: string, retryCount: number): Promise<BalanceCleanupResult> {
        const cleanupLockKey = `${this.CLEANUP_LOCK_PREFIX}:${dbprefix}`;
        let balanceLockId: string | null = null;
        
        try {
            // Step 1: Check if balance operations are currently active
            if (this.balanceRepository) {
                const balanceExists = await this.balanceRepository.exists(dbprefix);
                if (balanceExists) {
                    // Try to acquire balance lock with a short timeout - if it fails, balance operations are active
                    balanceLockId = await this.balanceRepository.lockBalance(dbprefix, this.LOCK_TIMEOUT_MS);
                    
                    if (!balanceLockId) {
                        // Balance operations are active, defer cleanup
                        if (retryCount < this.MAX_CLEANUP_RETRIES) {
                            await this.delay(this.CLEANUP_RETRY_DELAY_MS);
                            return await this.executeCleanupWithRetry(dbprefix, retryCount + 1);
                        }
                        
                        return {
                            dbprefix,
                            success: false,
                            keysRemoved: [],
                            error: 'Balance operations are active, cleanup deferred after maximum retries',
                            cleanupAt: new Date()
                        };
                    }
                }
            }

            // Step 2: Acquire cleanup lock (shorter timeout to avoid blocking)
            const acquired = await this.redisClient.set(
                cleanupLockKey,
                'locked',
                'PX',
                this.LOCK_TIMEOUT_MS,
                'NX'
            );
            
            if (!acquired) {
                // Another cleanup is in progress, defer this one
                if (retryCount < this.MAX_CLEANUP_RETRIES) {
                    await this.delay(this.CLEANUP_RETRY_DELAY_MS);
                    return await this.executeCleanupWithRetry(dbprefix, retryCount + 1);
                }
                
                return {
                    dbprefix,
                    success: false,
                    keysRemoved: [],
                    error: 'Another cleanup operation is in progress, maximum retries exceeded',
                    cleanupAt: new Date()
                };
            }

            // Step 3: Execute cleanup quickly to minimize lock time
            const keysToRemove = this.BALANCE_KEYS.map(key => `${dbprefix}:${key}`);
            const removedKeys: string[] = [];

            // Use pipeline for faster execution
            const pipeline = this.redisClient.pipeline();
            
            for (const key of keysToRemove) {
                pipeline.exists(key);
            }
            
            const existsResults = await pipeline.exec();
            
            if (existsResults) {
                const deleteCommands = this.redisClient.pipeline();
                
                for (let i = 0; i < keysToRemove.length; i++) {
                    if (existsResults[i] && existsResults[i][1] === 1) {
                        deleteCommands.del(keysToRemove[i]);
                        removedKeys.push(keysToRemove[i]);
                    }
                }
                
                if (removedKeys.length > 0) {
                    await deleteCommands.exec();
                }
            }

            // Step 4: Quickly reinitialize balance if cleanup was successful
            if (this.balanceRepository && this.tenantDatabaseName && removedKeys.length > 0) {
                try {
                    const utilityService = new BalanceUtilityService(
                        this.balanceRepository,
                        dbprefix,
                        this.tenantDatabaseName
                    );
                    await utilityService.initializeBalance(dbprefix, this.tenantDatabaseName);
                } catch (reinitError) {
                    // Log error but don't fail the cleanup
                    console.error(`Failed to reinitialize balance for ${dbprefix} after cleanup:`, reinitError);
                    return {
                        dbprefix,
                        success: true,
                        keysRemoved: removedKeys,
                        error: `Cleanup successful but reinitialization failed: ${reinitError instanceof Error ? reinitError.message : 'Unknown error'}`,
                        cleanupAt: new Date()
                    };
                }
            }

            return {
                dbprefix,
                success: true,
                keysRemoved: removedKeys,
                cleanupAt: new Date()
            };

        } catch (error) {
            // If cleanup fails, retry with exponential backoff
            if (retryCount < this.MAX_CLEANUP_RETRIES) {
                const delay = this.CLEANUP_RETRY_DELAY_MS * Math.pow(2, retryCount);
                await this.delay(delay);
                return await this.executeCleanupWithRetry(dbprefix, retryCount + 1);
            }
            
            return {
                dbprefix,
                success: false,
                keysRemoved: [],
                error: `Cleanup failed after ${retryCount + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
                cleanupAt: new Date()
            };
        } finally {
            // Step 5: Release locks immediately
            const cleanupPromises: Promise<any>[] = [];
            
            try {
                // Release balance lock first (highest priority)
                if (balanceLockId && this.balanceRepository) {
                    cleanupPromises.push(this.balanceRepository.releaseLock(dbprefix, balanceLockId));
                }
                
                // Release cleanup lock
                cleanupPromises.push(this.redisClient.del(cleanupLockKey));
                
                // Execute all cleanup operations in parallel
                await Promise.all(cleanupPromises);
            } catch (lockError) {
                console.error(`Failed to release locks for ${dbprefix}:`, lockError);
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async removeCleanupTimer(dbprefix: string): Promise<void> {
        try {
            const key = `${this.CLEANUP_TIMER_PREFIX}:${dbprefix}`;
            await this.redisClient.del(key);
        } catch (error) {
            throw new BalanceCleanupError(
                `Failed to remove cleanup timer: ${error instanceof Error ? error.message : 'Unknown error'}`,
                dbprefix
            );
        }
    }

    async hasActiveCleanupTimer(dbprefix: string): Promise<boolean> {
        try {
            const key = `${this.CLEANUP_TIMER_PREFIX}:${dbprefix}`;
            const timer = await this.getCleanupTimer(key);
            return timer !== null && timer.isActive;
        } catch (error) {
            return false;
        }
    }

    private async storeCleanupTimer(timer: BalanceCleanupTimer): Promise<void> {
        const key = `${this.CLEANUP_TIMER_PREFIX}:${timer.dbprefix}`;
        const data = {
            scheduled_at: timer.scheduledAt.toISOString(),
            expires_at: timer.expiresAt.toISOString(),
            is_active: timer.isActive.toString(),
            ...(timer.lastResetAt && { last_reset_at: timer.lastResetAt.toISOString() })
        };

        await this.redisClient.hmset(key, data);
    }

    private async getCleanupTimer(key: string): Promise<BalanceCleanupTimer | null> {
        const data = await this.redisClient.hgetall(key);
        
        if (!data.scheduled_at || !data.expires_at) {
            return null;
        }

        const dbprefix = key.replace(`${this.CLEANUP_TIMER_PREFIX}:`, '');
        
        return {
            dbprefix,
            scheduledAt: new Date(data.scheduled_at),
            expiresAt: new Date(data.expires_at),
            isActive: data.is_active === 'true',
            ...(data.last_reset_at && { lastResetAt: new Date(data.last_reset_at) })
        };
    }

    private async scanKeys(pattern: string): Promise<string[]> {
        let cursor = '0';
        let keys: string[] = [];

        do {
            const [nextCursor, batch] = await this.redisClient.scan(
                cursor,
                'MATCH',
                pattern,
                'COUNT',
                100
            );
            cursor = nextCursor;
            keys.push(...batch);
        } while (cursor !== '0');

        return keys;
    }
} 