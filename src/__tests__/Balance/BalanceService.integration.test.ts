import { BalanceService } from '@shared/services/BalanceService';
import { BalanceCleanupService } from '@shared/services/BalanceCleanupService';
import { BalanceRepositoryInterface } from '@shared/domain/interfaces/BalanceRepositoryInterface';
import { BalanceCleanupRepositoryInterface } from '@shared/domain/interfaces/BalanceCleanupRepositoryInterface';
import { Balance, BalanceOperation, BalanceOperationResult } from '@shared/domain/entities/Balance';
import { BalanceCleanupTimer, BalanceCleanupResult } from '@shared/domain/entities/BalanceCleanup';

// Mock Balance Repository
class MockBalanceRepository implements BalanceRepositoryInterface {
    private balances: Map<string, Balance> = new Map();
    private operations: BalanceOperation[] = [];

    async getBalance(dbprefix: string): Promise<Balance | null> {
        return this.balances.get(dbprefix) || null;
    }

    async createBalance(balance: Balance): Promise<Balance> {
        this.balances.set(balance.dbprefix, balance);
        return balance;
    }

    async executeOperation(operation: BalanceOperation): Promise<BalanceOperationResult> {
        this.operations.push(operation);
        
        const balance = this.balances.get(operation.dbprefix);
        if (!balance) {
            return {
                success: false,
                error: 'Balance not found',
                operationId: operation.id
            };
        }

        // Simulate operation result with zero pending transaction amount
        const updatedBalance: Balance = {
            ...balance,
            pendingTransactionAmount: 0, // This triggers cleanup
            lastUpdated: new Date()
        };

        this.balances.set(operation.dbprefix, updatedBalance);

        return {
            success: true,
            balance: updatedBalance,
            operationId: operation.id
        };
    }

    async executeTransaction(operations: BalanceOperation[]): Promise<BalanceOperationResult[]> {
        return Promise.all(operations.map(op => this.executeOperation(op)));
    }

    async getOperationHistory(dbprefix: string, limit?: number): Promise<BalanceOperation[]> {
        const userOps = this.operations.filter(op => op.dbprefix === dbprefix);
        return limit ? userOps.slice(0, limit) : userOps;
    }

    async createSnapshot(dbprefix: string): Promise<any> {
        const balance = this.balances.get(dbprefix);
        return balance ? { ...balance, snapshotId: 'test-snapshot', createdAt: new Date() } : null;
    }

    async exists(dbprefix: string): Promise<boolean> {
        return this.balances.has(dbprefix);
    }

    async lockBalance(dbprefix: string, timeoutMs?: number): Promise<string | null> {
        return `lock-${dbprefix}`;
    }

    async releaseLock(dbprefix: string, lockId: string): Promise<boolean> {
        return true;
    }

    // Test helpers
    setBalance(dbprefix: string, balance: Balance) {
        this.balances.set(dbprefix, balance);
    }

    clear() {
        this.balances.clear();
        this.operations.length = 0;
    }
}

// Mock Cleanup Repository
class MockCleanupRepository implements BalanceCleanupRepositoryInterface {
    private timers: Map<string, BalanceCleanupTimer> = new Map();

    async scheduleCleanup(dbprefix: string, delayMinutes: number): Promise<void> {
        const timer: BalanceCleanupTimer = {
            dbprefix,
            scheduledAt: new Date(),
            expiresAt: new Date(Date.now() + delayMinutes * 60 * 1000),
            isActive: true
        };
        this.timers.set(dbprefix, timer);
    }

    async resetCleanupTimer(dbprefix: string, delayMinutes: number): Promise<void> {
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
        return [];
    }

    async getActiveCleanupTimers(): Promise<BalanceCleanupTimer[]> {
        return Array.from(this.timers.values());
    }

    async executeCleanup(dbprefix: string): Promise<BalanceCleanupResult> {
        return {
            dbprefix,
            success: true,
            keysRemoved: [`${dbprefix}:current_balance`],
            cleanupAt: new Date()
        };
    }

    async removeCleanupTimer(dbprefix: string): Promise<void> {
        this.timers.delete(dbprefix);
    }

    async hasActiveCleanupTimer(dbprefix: string): Promise<boolean> {
        return this.timers.has(dbprefix);
    }

    clear() {
        this.timers.clear();
    }
}

describe('BalanceService Integration with Cleanup', () => {
    let balanceService: BalanceService;
    let balanceRepository: MockBalanceRepository;
    let cleanupRepository: MockCleanupRepository;
    let cleanupService: BalanceCleanupService;

    beforeEach(() => {
        balanceRepository = new MockBalanceRepository();
        cleanupRepository = new MockCleanupRepository();
        cleanupService = new BalanceCleanupService(cleanupRepository, {
            defaultCleanupDelayMinutes: 30,
            enableLogging: false
        });

        balanceService = new BalanceService(
            balanceRepository,
            { maxRetries: 1, retryDelayMs: 10, defaultCreditLimit: 0 },
            'test-tenant',
            'test-db',
            cleanupService
        );
    });

    afterEach(() => {
        balanceRepository.clear();
        cleanupRepository.clear();
    });

    describe('Cleanup Integration', () => {
        beforeEach(() => {
            // Setup initial balance
            const initialBalance: Balance = {
                dbprefix: 'user123',
                currentBalance: 1000,
                availableBalance: 1000,
                creditLimit: 0,
                totalFundAvailable: 1000,
                pendingTransactionAmount: 100,
                version: 1,
                lastUpdated: new Date()
            };
            balanceRepository.setBalance('user123', initialBalance);
        });

        it('should schedule cleanup when progressPayment results in zero pending amount', async () => {
            const result = await balanceService.progressPayment('user123', 'test-db', 100);

            expect(result).toBe(true);
            
            const hasTimer = await cleanupRepository.hasActiveCleanupTimer('user123');
            expect(hasTimer).toBe(true);
        });

        it('should work without cleanup service (backward compatibility)', () => {
            const balanceServiceWithoutCleanup = new BalanceService(
                balanceRepository,
                { maxRetries: 1, retryDelayMs: 10, defaultCreditLimit: 0 },
                'test-tenant',
                'test-db'
                // No cleanup service provided
            );

            expect(balanceServiceWithoutCleanup).toBeDefined();
        });
    });
});
