import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
    Balance,
    BalanceOperation,
    BalanceOperationResult,
    BalanceSnapshot,
    BalanceValidationError
} from '@shared/domain/entities/Balance';
import { BalanceRepositoryInterface } from '@shared/domain/interfaces/BalanceRepositoryInterface';
import { redisKeys } from '@shared/constants/redisKeys';

export class RedisBalanceRepository implements BalanceRepositoryInterface {
    private redis: Redis;
    private balanceOperationScript: string = '';
    private createBalanceScript: string = '';
    private balanceOperationSha: string | null = null;
    private createBalanceSha: string | null = null;

    constructor(redis: Redis) {
        this.redis = redis;
        this.loadLuaScripts();
    }

    private loadLuaScripts(): void {
        // For now, we'll load the scripts inline to avoid __dirname issues
        // In a production environment, you might want to load from files
        this.balanceOperationScript = `
            -- Balance Operations Lua Script (inline version)
            local balanceKey = KEYS[1]
            local auditKey = KEYS[2]
            local lockKey = KEYS[3]

            local operationType = ARGV[1]
            local amount = tonumber(ARGV[2])
            local operationId = ARGV[3]
            local timestamp = ARGV[4]
            local expectedVersion = tonumber(ARGV[5])
            local metadata = ARGV[6] or "{}"

            if redis.call('EXISTS', balanceKey) == 0 then
                return {false, "Balance not found"}
            end

            local currentBalance = redis.call('HMGET', balanceKey,
                'current_balance', 'available_balance', 'credit_limit',
                'total_fund_available', 'pending_transaction_amount', 'version')

            local current = tonumber(currentBalance[1]) or 0
            local available = tonumber(currentBalance[2]) or 0
            local creditLimit = tonumber(currentBalance[3]) or 0
            local totalFund = tonumber(currentBalance[4]) or 0
            local pending = tonumber(currentBalance[5]) or 0
            local version = tonumber(currentBalance[6]) or 0

            if expectedVersion ~= -1 and version ~= expectedVersion then
                return {false, "Version mismatch", version}
            end

            local newCurrent = current
            local newAvailable = available
            local newTotalFund = totalFund
            local newPending = pending

            if operationType == "progress_payment" then
                if newTotalFund < amount then
                    return {false, "Insufficient available balance", available}
                end
                newAvailable = available - amount
                newTotalFund = totalFund - amount
                newPending = pending + amount
            elseif operationType == "reverse_payment" then
                newAvailable = available + amount
                newTotalFund = totalFund + amount
                newPending = pending - amount
            elseif operationType == "complete_payment" then
                if pending < amount then
                    return {false, "Insufficient pending amount", pending}
                end
                newCurrent = current - amount
                newPending = pending - amount
            elseif operationType == "refund_payment" then
                if pending < amount then
                    return {false, "Insufficient pending amount", pending}
                end
                newCurrent = current + amount
                newAvailable = available + amount
                newTotalFund = totalFund + amount
                newPending = pending - amount
            else
                return {false, "Invalid operation type"}
            end

            if newCurrent < 0 or newAvailable < 0 or newTotalFund < 0 or newPending < 0 then
                return {false, "Operation would result in negative balance"}
            end

            local newVersion = version + 1
            redis.call('HMSET', balanceKey,
                'current_balance', newCurrent,
                'available_balance', newAvailable,
                'total_fund_available', newTotalFund,
                'pending_transaction_amount', newPending,
                'version', newVersion,
                'last_updated', timestamp)

            local auditEntry = {
                operation_id = operationId,
                operation_type = operationType,
                amount = amount,
                timestamp = timestamp,
                previous_version = version,
                new_version = newVersion,
                metadata = metadata
            }

            redis.call('LPUSH', auditKey, cjson.encode(auditEntry))
            redis.call('LTRIM', auditKey, 0, 999)

            return {true, {
                current_balance = newCurrent,
                available_balance = newAvailable,
                credit_limit = creditLimit,
                total_fund_available = newTotalFund,
                pending_transaction_amount = newPending,
                version = newVersion,
                last_updated = timestamp
            }}
        `;

        this.createBalanceScript = `
            -- Create Balance Lua Script (inline version)
            local balanceKey = KEYS[1]
            local username = ARGV[1]
            local currentBalance = tonumber(ARGV[2]) or 0
            local availableBalance = tonumber(ARGV[3]) or 0
            local creditLimit = tonumber(ARGV[4]) or 0
            local totalFundAvailable = tonumber(ARGV[5]) or 0
            local pendingTransactionAmount = tonumber(ARGV[6]) or 0
            local timestamp = ARGV[7]

            if redis.call('EXISTS', balanceKey) == 1 then
                return {false, "Balance already exists"}
            end

            redis.call('HMSET', balanceKey,
                'username', username,
                'current_balance', currentBalance,
                'available_balance', availableBalance,
                'credit_limit', creditLimit,
                'total_fund_available', totalFundAvailable,
                'pending_transaction_amount', pendingTransactionAmount,
                'version', 1,
                'last_updated', timestamp)

            return {true, {
                username = username,
                current_balance = currentBalance,
                available_balance = availableBalance,
                credit_limit = creditLimit,
                total_fund_available = totalFundAvailable,
                pending_transaction_amount = pendingTransactionAmount,
                version = 1,
                last_updated = timestamp
            }}
        `;
    }

    private async ensureScriptsLoaded(): Promise<void> {
        try {
            if (!this.balanceOperationSha) {
                // Use the correct ioredis method to load scripts
                this.balanceOperationSha = await this.redis.call('SCRIPT', 'LOAD', this.balanceOperationScript) as string;
            }
            if (!this.createBalanceSha) {
                this.createBalanceSha = await this.redis.call('SCRIPT', 'LOAD', this.createBalanceScript) as string;
            }
        } catch (error) {
            console.error('Failed to load Lua scripts:', error);
            throw new Error('Failed to initialize Redis scripts');
        }
    }

    private getBalanceKey(dbprefix: string): string {
        return `${redisKeys.REDIS_KEY_BALANCE}:${dbprefix}`;
    }

    private getAuditKey(dbprefix: string): string {
        return `${redisKeys.REDIS_KEY_BALANCE_AUDIT}:${dbprefix}`;
    }

    private getLockKey(dbprefix: string): string {
        return `${redisKeys.REDIS_KEY_BALANCE_LOCK}:${dbprefix}`;
    }

    private parseBalance(data: Record<string, string>): Balance {
        return {
            dbprefix: data.dbprefix,
            currentBalance: parseFloat(data.current_balance) || 0,
            availableBalance: parseFloat(data.available_balance) || 0,
            creditLimit: parseFloat(data.credit_limit) || 0,
            totalFundAvailable: parseFloat(data.total_fund_available) || 0,
            pendingTransactionAmount: parseFloat(data.pending_transaction_amount) || 0,
            version: parseInt(data.version) || 0,
            lastUpdated: new Date(data.last_updated)
        };
    }

    async getBalance(dbprefix: string): Promise<Balance | null> {
        const balanceKey = this.getBalanceKey(dbprefix);
        const data = await this.redis.hgetall(balanceKey);

        if (!data || Object.keys(data).length === 0) {
            return null;
        }

        return this.parseBalance(data);
    }

    async createBalance(balance: Balance): Promise<Balance> {
        await this.ensureScriptsLoaded();

        const balanceKey = this.getBalanceKey(balance.dbprefix);
        const timestamp = new Date().toISOString();

        const result = await this.redis.evalsha(
            this.createBalanceSha!,
            1,
            balanceKey,
            balance.dbprefix,
            balance.currentBalance.toString(),
            balance.availableBalance.toString(),
            balance.creditLimit.toString(),
            balance.totalFundAvailable.toString(),
            balance.pendingTransactionAmount.toString(),
            timestamp
        ) as [boolean, any];

        if (!result[0]) {
            throw new BalanceValidationError(result[1]);
        }

        return this.parseBalance(result[1]);
    }

    async executeOperation(operation: BalanceOperation): Promise<BalanceOperationResult> {
        await this.ensureScriptsLoaded();

        const balanceKey = this.getBalanceKey(operation.dbprefix);
        const auditKey = this.getAuditKey(operation.dbprefix);
        const lockKey = this.getLockKey(operation.dbprefix);

        try {
            const result = await this.redis.evalsha(
                this.balanceOperationSha!,
                3,
                balanceKey,
                auditKey,
                lockKey,
                operation.operationType,
                operation.amount.toString(),
                operation.id,
                operation.timestamp.toISOString(),
                '-1',
                JSON.stringify(operation.metadata || {})
            ) as [boolean, any, number?];

            if (!result[0]) {
                const errorMessage = result[1];

                if (errorMessage.includes('Insufficient')) {
                    return {
                        success: false,
                        error: errorMessage,
                        operationId: operation.id
                    };
                }

                return {
                    success: false,
                    error: errorMessage,
                    operationId: operation.id
                };
            }

            return {
                success: true,
                balance: this.parseBalance(result[1]),
                operationId: operation.id
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                operationId: operation.id
            };
        }
    }

    async executeTransaction(operations: BalanceOperation[]): Promise<BalanceOperationResult[]> {
        const results: BalanceOperationResult[] = [];


        const operationsByUser = operations.reduce((acc, op) => {
            if (!acc[op.dbprefix]) {
                acc[op.dbprefix] = [];
            }
            acc[op.dbprefix].push(op);
            return acc;
        }, {} as Record<string, BalanceOperation[]>);


        for (const [username, userOps] of Object.entries(operationsByUser)) {
            const lockId = await this.lockBalance(username, 5000);

            try {
                if (!lockId) {
                    userOps.forEach(op => {
                        results.push({
                            success: false,
                            error: 'Could not acquire lock',
                            operationId: op.id
                        });
                    });
                    continue;
                }

                for (const operation of userOps) {
                    const result = await this.executeOperation(operation);
                    results.push(result);

                    if (!result.success) {
                        console.warn(`Operation ${operation.id} failed: ${result.error}`);
                    }
                }
            } finally {
                if (lockId) {
                    await this.releaseLock(username, lockId);
                }
            }
        }

        return results;
    }

    async getOperationHistory(dbprefix: string, limit: number = 100): Promise<BalanceOperation[]> {
        const auditKey = this.getAuditKey(dbprefix);
        const entries = await this.redis.lrange(auditKey, 0, limit - 1);

        return entries.map((entry: string) => {
            const data = JSON.parse(entry);
            return {
                id: data.operation_id,
                dbprefix: dbprefix,
                operationType: data.operation_type,
                amount: data.amount,
                timestamp: new Date(data.timestamp),
                metadata: data.metadata ? JSON.parse(data.metadata) : undefined
            };
        });
    }

    async createSnapshot(dbprefix: string): Promise<BalanceSnapshot> {
        const balance = await this.getBalance(dbprefix);
        if (!balance) {
            throw new BalanceValidationError('Balance not found');
        }

        const snapshot: BalanceSnapshot = {
            ...balance,
            snapshotId: uuidv4(),
            createdAt: new Date()
        };


        const snapshotKey = `${redisKeys.REDIS_KEY_BALANCE}:snapshot:${dbprefix}:${snapshot.snapshotId}`;
        await this.redis.hmset(snapshotKey, {
            ...snapshot,
            createdAt: snapshot.createdAt.toISOString()
        });


        await this.redis.expire(snapshotKey, 90 * 24 * 60 * 60);

        return snapshot;
    }

    async exists(dbprefix: string): Promise<boolean> {
        const balanceKey = this.getBalanceKey(dbprefix);
        return (await this.redis.exists(balanceKey)) === 1;
    }

    async lockBalance(dbprefix: string, timeoutMs: number = 5000): Promise<string | null> {
        const lockKey = this.getLockKey(dbprefix);
        const lockId = uuidv4();

        const result = await this.redis.set(lockKey, lockId, 'PX', timeoutMs, 'NX');
        return result === 'OK' ? lockId : null;
    }

    async releaseLock(dbprefix: string, lockId: string): Promise<boolean> {
        const lockKey = this.getLockKey(dbprefix);

        const script = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            else
                return 0
            end
        `;

        const result = await this.redis.eval(script, 1, lockKey, lockId) as number;
        return result === 1;
    }
}
