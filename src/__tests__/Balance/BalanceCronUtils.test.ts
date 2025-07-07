import { executeBalanceCleanupCron, getBalanceCleanupStats, balanceCleanupHealthCheck } from '@shared/utils/BalanceCronUtils';

// Mock Redis client
const mockRedisClient = {
    scan: jest.fn(),
    hgetall: jest.fn(),
    hmset: jest.fn(),
    del: jest.fn(),
    exists: jest.fn()
};

// Mock the getRedisClient function
jest.mock('@shared/configs/redisConfig', () => ({
    getRedisClient: () => mockRedisClient
}));

describe('BalanceCronUtils', () => {
    let originalDateNow: () => number;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock Date.now to increment for execution time calculation
        originalDateNow = Date.now;
        let mockTime = 1234567890000;
        Date.now = jest.fn(() => mockTime += 100); // Increment by 100ms each call
    });
    
    afterEach(() => {
        Date.now = originalDateNow;
    });

    describe('executeBalanceCleanupCron', () => {
        it('should execute cleanup successfully with no timers', async () => {
            // Mock no expired timers
            mockRedisClient.scan.mockResolvedValue(['0', []]);
            
            const result = await executeBalanceCleanupCron();
            
            expect(result.totalProcessed).toBe(0);
            expect(result.successful).toBe(0);
            expect(result.failed).toBe(0);
            expect(result.results).toHaveLength(0);
            expect(result.executionTime).toBeGreaterThan(0);
        });

        it('should execute cleanup successfully with expired timers', async () => {
            const mockTimerKey = 'balance_cleanup_timer:user123';
            const mockTimerData = {
                scheduled_at: new Date(Date.now() - 60000).toISOString(),
                expires_at: new Date(Date.now() - 1000).toISOString(), // expired
                is_active: 'true'
            };

            // Mock finding expired timers
            mockRedisClient.scan.mockResolvedValue(['0', [mockTimerKey]]);
            mockRedisClient.hgetall.mockResolvedValue(mockTimerData);
            
            // Mock balance keys existence and deletion
            mockRedisClient.exists.mockResolvedValue(1);
            mockRedisClient.del.mockResolvedValue(1);

            const result = await executeBalanceCleanupCron();
            
            expect(result.totalProcessed).toBe(1);
            expect(result.successful).toBe(1);
            expect(result.failed).toBe(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0].success).toBe(true);
        });

        it('should handle errors gracefully', async () => {
            mockRedisClient.scan.mockRejectedValue(new Error('Redis connection failed'));
            
            const result = await executeBalanceCleanupCron();
            
            expect(result.totalProcessed).toBe(0);
            expect(result.successful).toBe(0);
            expect(result.failed).toBe(1);
            expect(result.results).toHaveLength(0);
        });

        it('should use custom configuration', async () => {
            mockRedisClient.scan.mockResolvedValue(['0', []]);
            
            const customConfig = {
                cleanupDelayMinutes: 60,
                maxConcurrentCleanups: 20,
                enableLogging: false
            };
            
            const result = await executeBalanceCleanupCron(customConfig);
            
            expect(result.totalProcessed).toBe(0);
            expect(result.executionTime).toBeGreaterThan(0);
        });
    });

    describe('getBalanceCleanupStats', () => {
        it('should return zero stats when no active timers', async () => {
            mockRedisClient.scan.mockResolvedValue(['0', []]);
            
            const stats = await getBalanceCleanupStats();
            
            expect(stats.activeTimersCount).toBe(0);
            expect(stats.oldestTimerAge).toBeUndefined();
            expect(stats.newestTimerAge).toBeUndefined();
        });

        it('should return correct stats for active timers', async () => {
            const mockTimerKey1 = 'balance_cleanup_timer:user123';
            const mockTimerKey2 = 'balance_cleanup_timer:user456';
            
            const now = Date.now();
            const oldTimer = new Date(now - 60000); // 1 minute ago
            const newTimer = new Date(now - 30000); // 30 seconds ago
            
            const mockTimerData1 = {
                scheduled_at: oldTimer.toISOString(),
                expires_at: new Date(now + 60000).toISOString(),
                is_active: 'true'
            };
            
            const mockTimerData2 = {
                scheduled_at: newTimer.toISOString(),
                expires_at: new Date(now + 60000).toISOString(),
                is_active: 'true'
            };

            mockRedisClient.scan.mockResolvedValue(['0', [mockTimerKey1, mockTimerKey2]]);
            mockRedisClient.hgetall
                .mockResolvedValueOnce(mockTimerData1)
                .mockResolvedValueOnce(mockTimerData2);
            
            const stats = await getBalanceCleanupStats();
            
            expect(stats.activeTimersCount).toBe(2);
            expect(stats.oldestTimerAge).toBeGreaterThan(50000); // Around 1 minute
            expect(stats.newestTimerAge).toBeGreaterThan(25000); // Around 30 seconds
        });

        it('should handle errors gracefully', async () => {
            mockRedisClient.scan.mockRejectedValue(new Error('Redis error'));
            
            const stats = await getBalanceCleanupStats();
            
            expect(stats.activeTimersCount).toBe(0);
        });
    });

    describe('balanceCleanupHealthCheck', () => {
        it('should return healthy status when system is working', async () => {
            mockRedisClient.scan.mockResolvedValue(['0', []]);
            
            const health = await balanceCleanupHealthCheck();
            
            expect(health.isHealthy).toBe(true);
            expect(health.activeTimers).toBe(0);
            expect(health.message).toContain('healthy');
        });

        it('should return healthy status when system works (stats returns data)', async () => {
            mockRedisClient.scan.mockResolvedValue(['0', []]);
            
            const health = await balanceCleanupHealthCheck();
            
            expect(health.isHealthy).toBe(true);
            expect(health.activeTimers).toBe(0);
            expect(health.message).toContain('healthy');
        });
    });
}); 