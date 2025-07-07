import { BalanceCleanupRepositoryInterface } from '@shared/domain/interfaces/BalanceCleanupRepositoryInterface';
import { BalanceCleanupTimer, BalanceCleanupResult, BalanceCleanupError } from '@shared/domain/entities/BalanceCleanup';

export interface BalanceCleanupServiceConfig {
    defaultCleanupDelayMinutes?: number;
    maxConcurrentCleanups?: number;
    enableLogging?: boolean;
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
            enableLogging: config.enableLogging ?? true
        };
    }

    async scheduleCleanupIfNeeded(dbprefix: string, pendingTransactionAmount: number): Promise<void> {
        try {
            if (pendingTransactionAmount === 0) {
                const hasTimer = await this.cleanupRepository.hasActiveCleanupTimer(dbprefix);
                
                if (hasTimer) {
                    await this.resetCleanupTimer(dbprefix);
                } else {
                    await this.scheduleCleanup(dbprefix);
                }
                
                this.logInfo(`Cleanup timer ${hasTimer ? 'reset' : 'scheduled'} for user: ${dbprefix}`);
            }
        } catch (error) {
            const message = `Failed to schedule cleanup for ${dbprefix}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            this.logError(message);
            throw new BalanceCleanupError(message, dbprefix);
        }
    }

    async scheduleCleanup(dbprefix: string, delayMinutes?: number): Promise<void> {
        const delay = delayMinutes ?? this.config.defaultCleanupDelayMinutes;
        await this.cleanupRepository.scheduleCleanup(dbprefix, delay);
        this.logInfo(`Cleanup scheduled for ${dbprefix} in ${delay} minutes`);
    }

    async resetCleanupTimer(dbprefix: string, delayMinutes?: number): Promise<void> {
        const delay = delayMinutes ?? this.config.defaultCleanupDelayMinutes;
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
            
            const results = await this.processCleanupBatch(expiredTimers);
            
            this.logCleanupResults(results);
            
            return results;
        } catch (error) {
            const message = `Failed to execute expired cleanups: ${error instanceof Error ? error.message : 'Unknown error'}`;
            this.logError(message);
            throw new BalanceCleanupError(message);
        }
    }

    async getActiveTimersCount(): Promise<number> {
        const activeTimers = await this.cleanupRepository.getActiveCleanupTimers();
        return activeTimers.length;
    }

    async getActiveTimers(): Promise<BalanceCleanupTimer[]> {
        return await this.cleanupRepository.getActiveCleanupTimers();
    }

    async cancelCleanup(dbprefix: string): Promise<void> {
        await this.cleanupRepository.removeCleanupTimer(dbprefix);
        this.logInfo(`Cleanup cancelled for user: ${dbprefix}`);
    }

    private async processCleanupBatch(timers: BalanceCleanupTimer[]): Promise<BalanceCleanupResult[]> {
        const batchSize = this.config.maxConcurrentCleanups;
        const results: BalanceCleanupResult[] = [];

        for (let i = 0; i < timers.length; i += batchSize) {
            const batch = timers.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(timer => this.executeCleanupForTimer(timer))
            );
            results.push(...batchResults);
        }

        return results;
    }

    private async executeCleanupForTimer(timer: BalanceCleanupTimer): Promise<BalanceCleanupResult> {
        try {
            const result = await this.cleanupRepository.executeCleanup(timer.dbprefix);
            
            if (result.success) {
                await this.cleanupRepository.removeCleanupTimer(timer.dbprefix);
            }
            
            return result;
        } catch (error) {
            return {
                dbprefix: timer.dbprefix,
                success: false,
                keysRemoved: [],
                error: error instanceof Error ? error.message : 'Unknown error',
                cleanupAt: new Date()
            };
        }
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