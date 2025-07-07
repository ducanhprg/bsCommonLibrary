import { BalanceCleanupService } from '@shared/services/BalanceCleanupService';
import { BalanceCleanupRepositoryInterface } from '@shared/domain/interfaces/BalanceCleanupRepositoryInterface';
import { BalanceCleanupTimer, BalanceCleanupResult, BalanceCleanupError } from '@shared/domain/entities/BalanceCleanup';

// Mock repository implementation
class MockBalanceCleanupRepository implements BalanceCleanupRepositoryInterface {
    private timers: Map<string, BalanceCleanupTimer> = new Map();
    private shouldFail = false;

    setShouldFail(fail: boolean) {
        this.shouldFail = fail;
    }

    async scheduleCleanup(dbprefix: string, delayMinutes: number): Promise<void> {
        if (this.shouldFail) throw new Error('Mock error');
        
        const timer: BalanceCleanupTimer = {
            dbprefix,
            scheduledAt: new Date(),
            expiresAt: new Date(Date.now() + delayMinutes * 60 * 1000),
            isActive: true
        };
        this.timers.set(dbprefix, timer);
    }

    async resetCleanupTimer(dbprefix: string, delayMinutes: number): Promise<void> {
        if (this.shouldFail) throw new Error('Mock error');
        
        const timer: BalanceCleanupTimer = {
            dbprefix,
            scheduledAt: new Date(),
            expiresAt: new Date(Date.now() + delayMinutes * 60 * 1000),
            isActive: true,
            lastResetAt: new Date()
        };
        this.timers.set(dbprefix, timer);
    }

    async getExpiredCleanupTimers(): Promise<BalanceCleanupTimer[]> {
        if (this.shouldFail) throw new Error('Mock error');
        
        const now = new Date();
        return Array.from(this.timers.values()).filter(timer => 
            timer.isActive && timer.expiresAt <= now
        );
    }

    async getActiveCleanupTimers(): Promise<BalanceCleanupTimer[]> {
        if (this.shouldFail) throw new Error('Mock error');
        
        return Array.from(this.timers.values()).filter(timer => timer.isActive);
    }

    async executeCleanup(dbprefix: string): Promise<BalanceCleanupResult> {
        if (this.shouldFail) {
            return {
                dbprefix,
                success: false,
                keysRemoved: [],
                error: 'Mock cleanup error',
                cleanupAt: new Date()
            };
        }

        return {
            dbprefix,
            success: true,
            keysRemoved: [`${dbprefix}:current_balance`, `${dbprefix}:available_balance`],
            cleanupAt: new Date()
        };
    }

    async removeCleanupTimer(dbprefix: string): Promise<void> {
        if (this.shouldFail) throw new Error('Mock error');
        this.timers.delete(dbprefix);
    }

    async hasActiveCleanupTimer(dbprefix: string): Promise<boolean> {
        if (this.shouldFail) throw new Error('Mock error');
        const timer = this.timers.get(dbprefix);
        return timer !== undefined && timer.isActive;
    }

    // Helper methods for testing
    addExpiredTimer(dbprefix: string) {
        const timer: BalanceCleanupTimer = {
            dbprefix,
            scheduledAt: new Date(Date.now() - 60000), // 1 minute ago
            expiresAt: new Date(Date.now() - 1000), // 1 second ago (expired)
            isActive: true
        };
        this.timers.set(dbprefix, timer);
    }

    clear() {
        this.timers.clear();
    }
}

describe('BalanceCleanupService', () => {
    let service: BalanceCleanupService;
    let mockRepository: MockBalanceCleanupRepository;

    beforeEach(() => {
        mockRepository = new MockBalanceCleanupRepository();
        service = new BalanceCleanupService(mockRepository, {
            defaultCleanupDelayMinutes: 30,
            maxConcurrentCleanups: 5,
            enableLogging: false
        });
    });

    afterEach(() => {
        mockRepository.clear();
    });

    describe('scheduleCleanupIfNeeded', () => {
        it('should schedule cleanup when pendingTransactionAmount is 0 and no existing timer', async () => {
            await service.scheduleCleanupIfNeeded('user123', 0);
            
            const hasTimer = await mockRepository.hasActiveCleanupTimer('user123');
            expect(hasTimer).toBe(true);
        });

        it('should reset timer when pendingTransactionAmount is 0 and timer exists', async () => {
            // First schedule
            await service.scheduleCleanup('user123');
            
            // Then trigger reset
            await service.scheduleCleanupIfNeeded('user123', 0);
            
            const timers = await mockRepository.getActiveCleanupTimers();
            const userTimer = timers.find(t => t.dbprefix === 'user123');
            expect(userTimer?.lastResetAt).toBeDefined();
        });

        it('should not schedule cleanup when pendingTransactionAmount is not 0', async () => {
            await service.scheduleCleanupIfNeeded('user123', 100);
            
            const hasTimer = await mockRepository.hasActiveCleanupTimer('user123');
            expect(hasTimer).toBe(false);
        });

        it('should throw BalanceCleanupError when repository fails', async () => {
            mockRepository.setShouldFail(true);
            
            await expect(service.scheduleCleanupIfNeeded('user123', 0))
                .rejects.toThrow(BalanceCleanupError);
        });
    });

    describe('scheduleCleanup', () => {
        it('should schedule cleanup with default delay', async () => {
            await service.scheduleCleanup('user123');
            
            const hasTimer = await mockRepository.hasActiveCleanupTimer('user123');
            expect(hasTimer).toBe(true);
        });

        it('should schedule cleanup with custom delay', async () => {
            await service.scheduleCleanup('user123', 60);
            
            const hasTimer = await mockRepository.hasActiveCleanupTimer('user123');
            expect(hasTimer).toBe(true);
        });
    });

    describe('executeExpiredCleanups', () => {
        it('should return empty array when no expired timers', async () => {
            const results = await service.executeExpiredCleanups();
            expect(results).toHaveLength(0);
        });

        it('should process expired timers successfully', async () => {
            mockRepository.addExpiredTimer('user123');
            mockRepository.addExpiredTimer('user456');
            
            const results = await service.executeExpiredCleanups();
            
            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);
        });

        it('should handle cleanup failures gracefully', async () => {
            mockRepository.addExpiredTimer('user123');
            
            // Override executeCleanup to return failure without throwing
            jest.spyOn(mockRepository, 'executeCleanup').mockResolvedValue({
                dbprefix: 'user123',
                success: false,
                keysRemoved: [],
                error: 'Mock cleanup error',
                cleanupAt: new Date()
            });
            
            const results = await service.executeExpiredCleanups();
            
            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(false);
            expect(results[0].error).toBe('Mock cleanup error');
        });

        it('should throw BalanceCleanupError when repository fails to get timers', async () => {
            mockRepository.setShouldFail(true);
            
            await expect(service.executeExpiredCleanups())
                .rejects.toThrow(BalanceCleanupError);
        });
    });

    describe('getActiveTimersCount', () => {
        it('should return 0 when no active timers', async () => {
            const count = await service.getActiveTimersCount();
            expect(count).toBe(0);
        });

        it('should return correct count of active timers', async () => {
            await service.scheduleCleanup('user123');
            await service.scheduleCleanup('user456');
            
            const count = await service.getActiveTimersCount();
            expect(count).toBe(2);
        });
    });

    describe('cancelCleanup', () => {
        it('should cancel cleanup timer', async () => {
            await service.scheduleCleanup('user123');
            
            let hasTimer = await mockRepository.hasActiveCleanupTimer('user123');
            expect(hasTimer).toBe(true);
            
            await service.cancelCleanup('user123');
            
            hasTimer = await mockRepository.hasActiveCleanupTimer('user123');
            expect(hasTimer).toBe(false);
        });
    });
}); 