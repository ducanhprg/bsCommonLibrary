import { Redis } from 'ioredis';
import { BalanceCleanupRepositoryInterface } from '@shared/domain/interfaces/BalanceCleanupRepositoryInterface';
import { BalanceCleanupTimer, BalanceCleanupResult, BalanceCleanupError } from '@shared/domain/entities/BalanceCleanup';

export interface AuditCleanupConfig {
    shouldPreserveAudit?: boolean; // Whether to preserve audit data when balance is cleaned
    auditRetentionDays?: number; // How long to keep audit data (0 = immediate cleanup)
    auditArchiveBeforeCleanup?: boolean; // Whether to create archive before cleanup
}

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
    private readonly AUDIT_KEYS = [
        'balance_audit' // Main audit trail
    ];
    private readonly ARCHIVE_KEY_PREFIX = 'balance_audit_archive'; // For archived audit data
    private readonly LOCK_TIMEOUT_MS = 5000; // 5 seconds timeout for cleanup operations
    private readonly CLEANUP_RETRY_DELAY_MS = 2000; // 2 seconds delay before retry
    private readonly MAX_CLEANUP_RETRIES = 3; // Maximum retry attempts for cleanup

    constructor(
        private readonly redisClient: Redis,
        private readonly auditConfig: AuditCleanupConfig = {}
    ) {
        // Set default audit configuration
        this.auditConfig = {
            shouldPreserveAudit: auditConfig.shouldPreserveAudit ?? false, // Default: clean up audit data
            auditRetentionDays: auditConfig.auditRetentionDays ?? 0, // Default: immediate cleanup
            auditArchiveBeforeCleanup: auditConfig.auditArchiveBeforeCleanup ?? true, // Default: archive before cleanup
            ...auditConfig
        };
    }

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
        
        try {
            // Step 1: Acquire cleanup lock (short timeout to avoid blocking)
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

            // Step 2: Handle audit data based on configuration
            const auditResult = await this.handleAuditCleanup(dbprefix);

            // Step 3: Execute balance data cleanup quickly using pipeline for better performance
            const balanceKeysToRemove = this.BALANCE_KEYS.map(key => `${dbprefix}:${key}`);
            const removedKeys: string[] = [];

            // Use pipeline for faster execution
            const pipeline = this.redisClient.pipeline();
            
            for (const key of balanceKeysToRemove) {
                pipeline.exists(key);
            }
            
            const existsResults = await pipeline.exec();
            
            if (existsResults) {
                const deleteCommands = this.redisClient.pipeline();
                
                for (let i = 0; i < balanceKeysToRemove.length; i++) {
                    if (existsResults[i] && existsResults[i][1] === 1) {
                        deleteCommands.del(balanceKeysToRemove[i]);
                        removedKeys.push(balanceKeysToRemove[i]);
                    }
                }
                
                if (removedKeys.length > 0) {
                    await deleteCommands.exec();
                }
            }

            // Add audit keys to removed keys list if they were processed
            if (auditResult.keysProcessed.length > 0) {
                removedKeys.push(...auditResult.keysProcessed);
            }

            // Log audit cleanup information
            if (auditResult.summary) {
                console.log(`[BalanceCleanup] ${dbprefix}: ${auditResult.summary}`);
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
            // Step 4: Release cleanup lock
            try {
                await this.redisClient.del(cleanupLockKey);
            } catch (lockError) {
                console.error(`Failed to release cleanup lock for ${dbprefix}:`, lockError);
            }
        }
    }

    private async handleAuditCleanup(dbprefix: string): Promise<{
        keysProcessed: string[];
        summary: string;
    }> {
        const auditKeysToCheck = this.AUDIT_KEYS.map(key => `${dbprefix}:${key}`);
        const keysProcessed: string[] = [];
        let summary = '';

        try {
            if (this.auditConfig.shouldPreserveAudit) {
                // Preserve audit data - only set expiration if configured
                if (this.auditConfig.auditRetentionDays && this.auditConfig.auditRetentionDays > 0) {
                    const expirationSeconds = this.auditConfig.auditRetentionDays * 24 * 60 * 60;
                    
                    for (const auditKey of auditKeysToCheck) {
                        const exists = await this.redisClient.exists(auditKey);
                        if (exists) {
                            await this.redisClient.expire(auditKey, expirationSeconds);
                            keysProcessed.push(`${auditKey}:expire_${this.auditConfig.auditRetentionDays}d`);
                        }
                    }
                    summary = `Audit data preserved with ${this.auditConfig.auditRetentionDays} day expiration`;
                } else {
                    summary = 'Audit data preserved indefinitely';
                }
            } else {
                // Clean up audit data
                if (this.auditConfig.auditArchiveBeforeCleanup) {
                    // Archive before cleanup
                    const archiveResult = await this.archiveAuditData(dbprefix);
                    if (archiveResult.archived) {
                        keysProcessed.push(archiveResult.archiveKey);
                    }
                }

                // Remove audit keys
                const pipeline = this.redisClient.pipeline();
                for (const auditKey of auditKeysToCheck) {
                    pipeline.exists(auditKey);
                }
                
                const auditExistsResults = await pipeline.exec();
                
                if (auditExistsResults) {
                    const deleteCommands = this.redisClient.pipeline();
                    
                    for (let i = 0; i < auditKeysToCheck.length; i++) {
                        if (auditExistsResults[i] && auditExistsResults[i][1] === 1) {
                            deleteCommands.del(auditKeysToCheck[i]);
                            keysProcessed.push(auditKeysToCheck[i]);
                        }
                    }
                    
                    if (keysProcessed.length > 0) {
                        await deleteCommands.exec();
                    }
                }

                summary = this.auditConfig.auditArchiveBeforeCleanup 
                    ? 'Audit data archived and cleaned up'
                    : 'Audit data cleaned up immediately';
            }
        } catch (error) {
            console.error(`Failed to handle audit cleanup for ${dbprefix}:`, error);
            summary = `Audit cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

        return { keysProcessed, summary };
    }

    private async archiveAuditData(dbprefix: string): Promise<{
        archived: boolean;
        archiveKey: string;
        entryCount?: number;
    }> {
        const auditKey = `${dbprefix}:balance_audit`;
        const archiveKey = `${this.ARCHIVE_KEY_PREFIX}:${dbprefix}:${Date.now()}`;

        try {
            // Get all audit entries
            const auditEntries = await this.redisClient.lrange(auditKey, 0, -1);
            
            if (auditEntries.length === 0) {
                return { archived: false, archiveKey: '' };
            }

            // Create archive with metadata
            const archiveData = {
                dbprefix,
                originalKey: auditKey,
                archivedAt: new Date().toISOString(),
                entryCount: auditEntries.length,
                entries: auditEntries
            };

            // Store archive (with expiration if configured)
            await this.redisClient.set(archiveKey, JSON.stringify(archiveData));
            
            // Set expiration for archive (default: 90 days)
            const archiveRetentionDays = this.auditConfig.auditRetentionDays || 90;
            await this.redisClient.expire(archiveKey, archiveRetentionDays * 24 * 60 * 60);

            return {
                archived: true,
                archiveKey,
                entryCount: auditEntries.length
            };
        } catch (error) {
            console.error(`Failed to archive audit data for ${dbprefix}:`, error);
            return { archived: false, archiveKey: '' };
        }
    }

    // New method to retrieve archived audit data
    async getArchivedAuditData(dbprefix: string): Promise<any[]> {
        try {
            const pattern = `${this.ARCHIVE_KEY_PREFIX}:${dbprefix}:*`;
            const archiveKeys = await this.scanKeys(pattern);
            
            const archives = [];
            for (const key of archiveKeys) {
                const archiveData = await this.redisClient.get(key);
                if (archiveData) {
                    archives.push(JSON.parse(archiveData));
                }
            }
            
            return archives.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());
        } catch (error) {
            console.error(`Failed to get archived audit data for ${dbprefix}:`, error);
            return [];
        }
    }

    // New method to get audit cleanup statistics
    async getAuditCleanupStats(): Promise<{
        activeAuditKeys: number;
        archivedAuditKeys: number;
        orphanedAuditKeys: number;
    }> {
        try {
            const auditPattern = '*:balance_audit';
            const balancePattern = '*:current_balance';
            const archivePattern = `${this.ARCHIVE_KEY_PREFIX}:*`;

            const [auditKeys, balanceKeys, archiveKeys] = await Promise.all([
                this.scanKeys(auditPattern),
                this.scanKeys(balancePattern),
                this.scanKeys(archivePattern)
            ]);

            // Extract dbprefixes
            const auditDbprefixes = new Set(auditKeys.map(key => key.replace(':balance_audit', '')));
            const balanceDbprefixes = new Set(balanceKeys.map(key => key.replace(':current_balance', '')));

            // Find orphaned audit keys (audit exists but balance doesn't)
            const orphanedCount = [...auditDbprefixes].filter(dbprefix => !balanceDbprefixes.has(dbprefix)).length;

            return {
                activeAuditKeys: auditKeys.length,
                archivedAuditKeys: archiveKeys.length,
                orphanedAuditKeys: orphanedCount
            };
        } catch (error) {
            console.error('Failed to get audit cleanup stats:', error);
            return { activeAuditKeys: 0, archivedAuditKeys: 0, orphanedAuditKeys: 0 };
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