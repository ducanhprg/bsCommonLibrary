import { RedisBalanceCleanupRepository } from '@shared/infrastructure/repositories/RedisBalanceCleanupRepository';
import { BalanceCleanupTimer, BalanceCleanupError } from '@shared/domain/entities/BalanceCleanup';
import { Redis } from 'ioredis';

// Mock Redis client
const mockRedisClient = {
    scan: jest.fn(),
    hgetall: jest.fn(),
    hmset: jest.fn(),
    del: jest.fn(),
    exists: jest.fn()
} as any;

describe('RedisBalanceCleanupRepository', () => {
    let repository: RedisBalanceCleanupRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        repository = new RedisBalanceCleanupRepository(mockRedisClient as Redis);
    });

    describe('scheduleCleanup', () => {
        it('should schedule cleanup timer successfully', async () => {
            mockRedisClient.hmset!.mockResolvedValue('OK');

            await repository.scheduleCleanup('user123', 30);

            expect(mockRedisClient.hmset).toHaveBeenCalledWith(
                'balance_cleanup_timer:user123',
                expect.objectContaining({
                    scheduled_at: expect.any(String),
                    expires_at: expect.any(String),
                    is_active: 'true'
                })
            );
        });

        it('should throw BalanceCleanupError when Redis operation fails', async () => {
            mockRedisClient.hmset!.mockRejectedValue(new Error('Redis error'));

            await expect(repository.scheduleCleanup('user123', 30))
                .rejects.toThrow(BalanceCleanupError);
        });
    });

    describe('executeCleanup', () => {
        it('should execute cleanup successfully', async () => {
            mockRedisClient.exists!.mockResolvedValue(1);
            mockRedisClient.del!.mockResolvedValue(1);

            const result = await repository.executeCleanup('user123');

            expect(result.success).toBe(true);
            expect(result.dbprefix).toBe('user123');
            expect(result.keysRemoved).toHaveLength(5);
            expect(result.keysRemoved).toContain('user123:current_balance');
            expect(result.keysRemoved).toContain('user123:available_balance');
            expect(result.keysRemoved).toContain('user123:credit_limit');
            expect(result.keysRemoved).toContain('user123:total_fund_available');
            expect(result.keysRemoved).toContain('user123:pending_transaction_amount');
        });

        it('should handle cleanup when some keys do not exist', async () => {
            mockRedisClient.exists!
                .mockResolvedValueOnce(1) // current_balance exists
                .mockResolvedValueOnce(0) // available_balance doesn't exist
                .mockResolvedValueOnce(1) // credit_limit exists
                .mockResolvedValueOnce(0) // total_fund_available doesn't exist
                .mockResolvedValueOnce(1); // pending_transaction_amount exists

            mockRedisClient.del!.mockResolvedValue(1);

            const result = await repository.executeCleanup('user123');

            expect(result.success).toBe(true);
            expect(result.keysRemoved).toHaveLength(3);
            expect(mockRedisClient.del).toHaveBeenCalledTimes(3);
        });

        it('should return error result when cleanup fails', async () => {
            mockRedisClient.exists!.mockRejectedValue(new Error('Redis error'));

            const result = await repository.executeCleanup('user123');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Redis error');
            expect(result.keysRemoved).toHaveLength(0);
        });
    });
});
