import { BalanceCleanupTimer, BalanceCleanupResult } from '@shared/domain/entities/BalanceCleanup';

export interface BalanceCleanupRepositoryInterface {
    /**
     * Schedule a cleanup timer for a user balance
     */
    scheduleCleanup(dbprefix: string, delayMinutes: number): Promise<void>;

    /**
     * Reset/refresh cleanup timer for a user
     */
    resetCleanupTimer(dbprefix: string, delayMinutes: number): Promise<void>;

    /**
     * Get active cleanup timers that are ready for cleanup
     */
    getExpiredCleanupTimers(): Promise<BalanceCleanupTimer[]>;

    /**
     * Get all active cleanup timers for monitoring
     */
    getActiveCleanupTimers(): Promise<BalanceCleanupTimer[]>;

    /**
     * Execute cleanup for a user (remove all 5 balance keys)
     */
    executeCleanup(dbprefix: string): Promise<BalanceCleanupResult>;

    /**
     * Remove cleanup timer (called after successful cleanup)
     */
    removeCleanupTimer(dbprefix: string): Promise<void>;

    /**
     * Check if cleanup timer exists for a user
     */
    hasActiveCleanupTimer(dbprefix: string): Promise<boolean>;
} 