import { BalanceCleanupRepositoryInterface } from '@shared/domain/interfaces/BalanceCleanupRepositoryInterface';
import { BalanceCleanupTimer, BalanceCleanupResult, BalanceCleanupError } from '@shared/domain/entities/BalanceCleanup';

export interface BalanceCleanupServiceConfig {
    defaultCleanupDelayMinutes?: number;
    maxConcurrentCleanups?: number;
    enableLogging?: boolean;
    cleanupTimeoutMs?: number; // Timeout for individual cleanup operations
    pendingAmountThreshold?: number; // Threshold for considering pending amount as zero
}

export class BalanceCleanupService {
    private readonly config: Required<BalanceCleanupServiceConfig>;

    constructor(
        private readonly cleanupRepository: BalanceCleanupRepositoryInterface,
        config: BalanceCleanupServiceConfig = {}
    ) {
        this.config = {
            defaultCleanupDelayMinutes: config.defaultCleanupDelayMinutes ?? 30,
            maxConcurrentCleanups: config.maxConcurrentCleanups ?? 10,
            enableLogging: config.enableLogging ?? true,
            cleanupTimeoutMs: config.cleanupTimeoutMs ?? 30000, // 30 seconds timeout
            pendingAmountThreshold: config.pendingAmountThreshold ?? 0.01 // Consider amounts less than 0.01 as zero
        };
    }

    async scheduleCleanupIfNeeded(dbprefix: string, pendingTransactionAmount: number): Promise<void> {
        try {
            // Validate input parameters
            if (!dbprefix || dbprefix.trim() === '') {
                throw new Error('Database prefix is required');
            }

            if (typeof pendingTransactionAmount !== 'number' || isNaN(pendingTransactionAmount)) {
                this.logError(`Invalid pending transaction amount for ${dbprefix}: ${pendingTransactionAmount}`);
                return; // Don't throw, just return gracefully
            }

            // Use threshold to handle floating point precision issues
            const isPendingZero = Math.abs(pendingTransactionAmount) < this.config.pendingAmountThreshold;
            
            if (isPendingZero) {
                const hasTimer = await this.cleanupRepository.hasActiveCleanupTimer(dbprefix);
                
                if (hasTimer) {
                    await this.resetCleanupTimer(dbprefix);
                    this.logInfo(`Cleanup timer reset for user: ${dbprefix}`);
                } else {
                    await this.scheduleCleanup(dbprefix);
                    this.logInfo(`Cleanup timer scheduled for user: ${dbprefix}`);
                }
            } else {
                // If pending amount is not zero, cancel any existing cleanup
                const hasTimer = await this.cleanupRepository.hasActiveCleanupTimer(dbprefix);
                if (hasTimer) {
                    await this.cancelCleanup(dbprefix);
                    this.logInfo(`Cleanup timer cancelled for user: ${dbprefix} (pending amount: ${pendingTransactionAmount})`);
                }
            }
        } catch (error) {
            const message = `Failed to schedule cleanup for ${dbprefix}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            this.logError(message);
            // Don't throw - this should not break the main operation
        }
    }

    async scheduleCleanup(dbprefix: string, delayMinutes?: number): Promise<void> {
        const delay = delayMinutes ?? this.config.defaultCleanupDelayMinutes;
        
        if (delay < 0) {
            throw new Error('Cleanup delay cannot be negative');
        }

        await this.cleanupRepository.scheduleCleanup(dbprefix, delay);
        this.logInfo(`Cleanup scheduled for ${dbprefix} in ${delay} minutes`);
    }

    async resetCleanupTimer(dbprefix: string, delayMinutes?: number): Promise<void> {
        const delay = delayMinutes ?? this.config.defaultCleanupDelayMinutes;
        
        if (delay < 0) {
            throw new Error('Cleanup delay cannot be negative');
        }

        await this.cleanupRepository.resetCleanupTimer(dbprefix, delay);
        this.logInfo(`Cleanup timer reset for ${dbprefix}, new delay: ${delay} minutes`);
    }

    async executeExpiredCleanups(): Promise<BalanceCleanupResult[]> {
        try {
            const expiredTimers = await this.cleanupRepository.getExpiredCleanupTimers();
            
            if (expiredTimers.length === 0) {
                this.logInfo('No expired cleanup timers found');
                return [];
            }

            this.logInfo(`Processing ${expiredTimers.length} expired cleanup timers`);
            
            // Validate timers before processing
            const validTimers = expiredTimers.filter(timer => this.validateTimer(timer));
            
            if (validTimers.length !== expiredTimers.length) {
                this.logError(`${expiredTimers.length - validTimers.length} invalid timers found and skipped`);
            }

            const results = await this.processCleanupBatch(validTimers);
            
            this.logCleanupResults(results);
            
            return results;
        } catch (error) {
            const message = `Failed to execute expired cleanups: ${error instanceof Error ? error.message : 'Unknown error'}`;
            this.logError(message);
            throw new BalanceCleanupError(message);
        }
    }

    async getActiveTimersCount(): Promise<number> {
        try {
            const activeTimers = await this.cleanupRepository.getActiveCleanupTimers();
            return activeTimers.length;
        } catch (error) {
            this.logError(`Failed to get active timers count: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return 0;
        }
    }

    async getActiveTimers(): Promise<BalanceCleanupTimer[]> {
        try {
            return await this.cleanupRepository.getActiveCleanupTimers();
        } catch (error) {
            this.logError(`Failed to get active timers: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return [];
        }
    }

    async cancelCleanup(dbprefix: string): Promise<void> {
        try {
            await this.cleanupRepository.removeCleanupTimer(dbprefix);
            this.logInfo(`Cleanup cancelled for user: ${dbprefix}`);
        } catch (error) {
            this.logError(`Failed to cancel cleanup for ${dbprefix}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    private async processCleanupBatch(timers: BalanceCleanupTimer[]): Promise<BalanceCleanupResult[]> {
        const batchSize = this.config.maxConcurrentCleanups;
        const results: BalanceCleanupResult[] = [];

        for (let i = 0; i < timers.length; i += batchSize) {
            const batch = timers.slice(i, i + batchSize);
            
            try {
                const batchResults = await Promise.allSettled(
                    batch.map(timer => this.executeCleanupForTimer(timer))
                );
                
                // Process settled results
                const processedResults = batchResults.map((result, index) => {
                    if (result.status === 'fulfilled') {
                        return result.value;
                    } else {
                        // Handle rejected promises
                        return {
                            dbprefix: batch[index].dbprefix,
                            success: false,
                            keysRemoved: [],
                            error: `Cleanup promise rejected: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`,
                            cleanupAt: new Date()
                        };
                    }
                });
                
                results.push(...processedResults);
            } catch (error) {
                // Handle batch-level errors
                this.logError(`Batch processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                
                // Create error results for all timers in this batch
                const errorResults = batch.map(timer => ({
                    dbprefix: timer.dbprefix,
                    success: false,
                    keysRemoved: [],
                    error: `Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    cleanupAt: new Date()
                }));
                
                results.push(...errorResults);
            }
        }

        return results;
    }

    private async executeCleanupForTimer(timer: BalanceCleanupTimer): Promise<BalanceCleanupResult> {
        const timeoutPromise = new Promise<BalanceCleanupResult>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Cleanup timeout after ${this.config.cleanupTimeoutMs}ms`));
            }, this.config.cleanupTimeoutMs);
        });

        const cleanupPromise = this.performCleanup(timer);

        try {
            const result = await Promise.race([cleanupPromise, timeoutPromise]);
            
            // Always try to remove the timer, regardless of cleanup success
            // This prevents infinite retries for problematic accounts
            try {
                await this.cleanupRepository.removeCleanupTimer(timer.dbprefix);
            } catch (timerError) {
                this.logError(`Failed to remove timer for ${timer.dbprefix}: ${timerError instanceof Error ? timerError.message : 'Unknown error'}`);
            }
            
            return result;
        } catch (error) {
            // Remove timer even on failure to prevent infinite retries
            try {
                await this.cleanupRepository.removeCleanupTimer(timer.dbprefix);
            } catch (timerError) {
                this.logError(`Failed to remove timer for ${timer.dbprefix} after cleanup failure: ${timerError instanceof Error ? timerError.message : 'Unknown error'}`);
            }
            
            return {
                dbprefix: timer.dbprefix,
                success: false,
                keysRemoved: [],
                error: error instanceof Error ? error.message : 'Unknown error',
                cleanupAt: new Date()
            };
        }
    }

    private async performCleanup(timer: BalanceCleanupTimer): Promise<BalanceCleanupResult> {
        return await this.cleanupRepository.executeCleanup(timer.dbprefix);
    }

    private validateTimer(timer: BalanceCleanupTimer): boolean {
        if (!timer) {
            this.logError('Invalid timer: null or undefined');
            return false;
        }

        if (!timer.dbprefix || timer.dbprefix.trim() === '') {
            this.logError('Invalid timer: missing dbprefix');
            return false;
        }

        if (!timer.expiresAt || !(timer.expiresAt instanceof Date)) {
            this.logError(`Invalid timer for ${timer.dbprefix}: missing or invalid expiresAt`);
            return false;
        }

        if (!timer.scheduledAt || !(timer.scheduledAt instanceof Date)) {
            this.logError(`Invalid timer for ${timer.dbprefix}: missing or invalid scheduledAt`);
            return false;
        }

        if (timer.expiresAt < timer.scheduledAt) {
            this.logError(`Invalid timer for ${timer.dbprefix}: expiresAt is before scheduledAt`);
            return false;
        }

        return true;
    }

    private logCleanupResults(results: BalanceCleanupResult[]): void {
        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;
        
        this.logInfo(`Cleanup results: ${successful} successful, ${failed} failed`);
        
        if (failed > 0) {
            const failedUsers = results
                .filter(r => !r.success)
                .map(r => `${r.dbprefix}: ${r.error}`)
                .join(', ');
            this.logError(`Failed cleanups: ${failedUsers}`);
        }
    }

    private logInfo(message: string): void {
        if (this.config.enableLogging) {
            console.log(`[BalanceCleanupService] ${message}`);
        }
    }

    private logError(message: string): void {
        if (this.config.enableLogging) {
            console.error(`[BalanceCleanupService] ERROR: ${message}`);
        }
    }
} 