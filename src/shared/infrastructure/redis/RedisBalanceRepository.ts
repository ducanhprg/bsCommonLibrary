import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
    Balance,
    BalanceOperation,
    BalanceOperationResult,
    BalanceSnapshot,
    BalanceValidationError
} from '@shared/domain/entities/Balance';
import { BalanceRepositoryInterface } from '@shared/domain/interfaces/BalanceRepositoryInterface';
import { redisKeys } from '@shared/constants/redisKeys';
import { Logger } from '@shared/logging/Logger';

export class RedisBalanceRepository implements BalanceRepositoryInterface {
    private redis: Redis;
    private balanceOperationScript: string = '';
    private createBalanceScript: string = '';
    private deleteBalanceScript: string = '';
    private balanceOperationSha: string | null = null;
    private createBalanceSha: string | null = null;
    private deleteBalanceSha: string | null = null;

    constructor(redis: Redis) {
        this.redis = redis;
        this.loadLuaScripts();
    }

    private loadLuaScripts(): void {
        // Load scripts from files for better maintainability
        try {
            // Load balanceOperations.lua
            this.balanceOperationScript = fs.readFileSync(
                path.join(__dirname, 'scripts', 'balanceOperations.lua'), 
                'utf8'
            );
            
            // Load createBalance.lua
            this.createBalanceScript = fs.readFileSync(
                path.join(__dirname, 'scripts', 'createBalance.lua'), 
                'utf8'
            );
            
            // Load deleteBalance.lua
            this.deleteBalanceScript = fs.readFileSync(
                path.join(__dirname, 'scripts', 'deleteBalance.lua'), 
                'utf8'
            );
        } catch (error) {
            Logger.warn('Could not load Lua scripts from files, falling back to inline scripts:', error);
            // Fallback to inline scripts if file loading fails
            this.loadInlineScripts();
        }
    }

    private loadInlineScripts(): void {
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

            elseif operationType == "balance_deposit" then
                -- Add to current and available balance
                newCurrent = current + amount
                newAvailable = available + amount
                newTotalFund = totalFund + amount

            elseif operationType == "balance_withdrawal" then
                -- Subtract from current and available balance
                if current < amount then
                    return {false, "Insufficient balance", current}
                end
                newCurrent = current - amount
                newAvailable = available - amount
                newTotalFund = totalFund - amount

            elseif operationType == "credit_limit_update" then
                -- Update credit limit and recalculate total fund available
                local newCreditLimitDiff = amount - creditLimit

                creditLimit = amount
                newTotalFund = totalFund + newCreditLimitDiff

            else
                return {false, "Invalid operation type"}
            end

            if newTotalFund < 0 or newPending < 0 then
                return {false, "Operation would result in negative Total Fund Available"}
            end

            local newVersion = version + 1
            redis.call('HMSET', balanceKey,
                'current_balance', newCurrent,
                'available_balance', newAvailable,
                'credit_limit', creditLimit,
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
            local currentBalance = tonumber(ARGV[2])
            local availableBalance = tonumber(ARGV[3])
            local creditLimit = tonumber(ARGV[4])
            local totalFundAvailable = tonumber(ARGV[5])
            local pendingTransactionAmount = tonumber(ARGV[6])
            local timestamp = ARGV[7]
            
            -- Validate that all numbers were parsed correctly
            if currentBalance == nil then currentBalance = 0 end
            if availableBalance == nil then availableBalance = 0 end
            if creditLimit == nil then creditLimit = 0 end
            if totalFundAvailable == nil then totalFundAvailable = 0 end
            if pendingTransactionAmount == nil then pendingTransactionAmount = 0 end

            -- For balance reset, delete existing balance if it exists
            if redis.call('EXISTS', balanceKey) == 1 then
                redis.call('DEL', balanceKey)
            end

            redis.call('HMSET', balanceKey,
                'dbprefix', username,
                'current_balance', currentBalance,
                'available_balance', availableBalance,
                'credit_limit', creditLimit,
                'total_fund_available', totalFundAvailable,
                'pending_transaction_amount', pendingTransactionAmount,
                'version', 1,
                'last_updated', timestamp)

            -- Return using simple array approach that definitely works with ioredis
            return {1, {
                username,
                tostring(currentBalance),
                tostring(availableBalance),
                tostring(creditLimit),
                tostring(totalFundAvailable),
                tostring(pendingTransactionAmount),
                '1',
                timestamp
            }}
        `;

        this.deleteBalanceScript = `
            -- Delete Balance Lua Script (inline version)
            local balanceKey = KEYS[1]
            local auditKey = KEYS[2]
            local operationId = ARGV[1]
            local timestamp = ARGV[2]
            local force = ARGV[3] or "false"
            
            if redis.call('EXISTS', balanceKey) == 0 then
                return {false, "Balance not found"}
            end
            
            local version = tonumber(redis.call('HGET', balanceKey, 'version')) or 0
            local pendingAmount = tonumber(redis.call('HGET', balanceKey, 'pending_transaction_amount')) or 0
            
            -- Check if there are pending transactions and force is not enabled
            if pendingAmount > 0 and force ~= "true" then
                return {false, "Cannot delete balance with pending transactions"}
            end
            
            -- Get current balance state for audit
            local current = redis.call('HMGET', balanceKey,
                'current_balance', 'available_balance', 'credit_limit',
                'total_fund_available', 'pending_transaction_amount')

            local currentBalance = tonumber(current[1]) or 0
            local availableBalance = tonumber(current[2]) or 0
            local creditLimit = tonumber(current[3]) or 0
            local totalFund = tonumber(current[4]) or 0
            local pending = tonumber(current[5]) or 0
            
            -- Delete the balance
            redis.call('DEL', balanceKey)
            
            -- Add audit entry for deletion
            local auditEntry = {
                operation_id = operationId,
                operation_type = force == "true" and 'balance_force_deletion' or 'balance_deletion',
                timestamp = timestamp,
                version = version,
                metadata = force == "true" and '{"action": "balance_force_reinitialization", "pending_amount_ignored": ' .. pending .. '}' or '{"action": "balance_reinitialization"}',
                previous_state = {
                    current_balance = currentBalance,
                    available_balance = availableBalance,
                    credit_limit = creditLimit,
                    total_fund_available = totalFund,
                    pending_transaction_amount = pending
                },
                new_state = {
                    deleted = true,
                    forced = force == "true"
                }
            }
            
            redis.call('LPUSH', auditKey, cjson.encode(auditEntry))
            redis.call('LTRIM', auditKey, 0, 999)
            
            return {true, force == "true" and "Balance force deleted successfully" or "Balance deleted successfully"}
        `;
    }

    private async ensureScriptsLoaded(): Promise<void> {
        try {
            if (!this.balanceOperationSha) {
                this.balanceOperationSha = await this.redis.call('SCRIPT', 'LOAD', this.balanceOperationScript) as string;
            }
            if (!this.createBalanceSha) {
                this.createBalanceSha = await this.redis.call('SCRIPT', 'LOAD', this.createBalanceScript) as string;
            }
            if (!this.deleteBalanceSha) {
                this.deleteBalanceSha = await this.redis.call('SCRIPT', 'LOAD', this.deleteBalanceScript) as string;
            }
        } catch (error) {
            Logger.error('Failed to load Lua scripts:', error);
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
        const currentBalance = this.parseFloat(data.current_balance);
        const availableBalance = this.parseFloat(data.available_balance);
        const creditLimit = this.parseFloat(data.credit_limit);
        const totalFundAvailable = this.parseFloat(data.total_fund_available);
        const pendingTransactionAmount = this.parseFloat(data.pending_transaction_amount);
        
        // Validate parsed values for potential issues
        if (isNaN(currentBalance) || isNaN(availableBalance) || isNaN(totalFundAvailable)) {
            Logger.warn('[RedisBalanceRepository] Invalid balance values detected:', {
                dbprefix: data.dbprefix,
                currentBalance,
                availableBalance,
                totalFundAvailable,
                rawData: data
            });
        }
        
        return {
            dbprefix: data.dbprefix,
            currentBalance,
            availableBalance,
            creditLimit,
            totalFundAvailable,
            pendingTransactionAmount,
            version: parseInt(data.version) || 0,
            lastUpdated: new Date(data.last_updated)
        };
    }
    
    private parseFloat(value: string): number {
        if (value === undefined || value === null || value === '') {
            return 0;
        }
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
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

        const args = [
            balance.dbprefix,
            balance.currentBalance.toString(),
            balance.availableBalance.toString(),
            balance.creditLimit.toString(),
            balance.totalFundAvailable.toString(),
            balance.pendingTransactionAmount.toString(),
            timestamp
        ];

        const result = await this.redis.evalsha(
            this.createBalanceSha!,
            1,
            balanceKey,
            ...args
        ) as [boolean, any];

        if (!result[0]) {
            Logger.error('[RedisBalanceRepository] Lua script failed to create balance:', {
                error: result[1],
                dbprefix: balance.dbprefix,
                balanceKey
            });
            throw new BalanceValidationError(result[1]);
        }

        // Handle array format from Lua script
        if (Array.isArray(result[1])) {
            const data = {
                dbprefix: result[1][0],
                current_balance: result[1][1],
                available_balance: result[1][2],
                credit_limit: result[1][3],
                total_fund_available: result[1][4],
                pending_transaction_amount: result[1][5],
                version: result[1][6],
                last_updated: result[1][7]
            };
            return this.parseBalance(data);
        }

        // Handle unexpected result format
        if (!result[1] || (typeof result[1] === 'object' && Object.keys(result[1]).length === 0)) {
            Logger.error('[RedisBalanceRepository] Lua script returned empty result:', {
                result,
                dbprefix: balance.dbprefix,
                balanceKey
            });
            throw new BalanceValidationError('Lua script returned empty balance data');
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
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;
        
        const result = await this.redis.eval(script, 1, lockKey, lockId) as number;
        return result === 1;
    }

    async updateBalance(dbprefix: string, amount: number, metadata?: Record<string, any>): Promise<Balance> {
        const operationType = amount >= 0 ? 'balance_deposit' : 'balance_withdrawal';
        
        // Create operation
        const operation: BalanceOperation = {
            id: uuidv4(),
            dbprefix: dbprefix,
            operationType: operationType as any,
            amount: Math.abs(amount),
            timestamp: new Date(),
            metadata
        };

        // Execute using the main balance operations script
        const result = await this.executeOperation(operation);

        if (!result.success) {
            throw new BalanceValidationError(result.error || 'Balance update failed');
        }

        return result.balance!;
    }

    async updateCreditLimit(dbprefix: string, amount: number, metadata?: Record<string, any>): Promise<Balance> {
        // Create operation for credit limit update
        const operation: BalanceOperation = {
            id: uuidv4(),
            dbprefix: dbprefix,
            operationType: 'credit_limit_update' as any,
            amount: amount,
            timestamp: new Date(),
            metadata
        };

        // Execute using the main balance operations script
        const result = await this.executeOperation(operation);

        if (!result.success) {
            throw new BalanceValidationError(result.error || 'Credit limit update failed');
        }

        return result.balance!;
    }

    async deleteBalance(dbprefix: string, force: boolean = false): Promise<boolean> {
        await this.ensureScriptsLoaded();

        const balanceKey = this.getBalanceKey(dbprefix);
        const auditKey = this.getAuditKey(dbprefix);
        const timestamp = new Date().toISOString();
        const operationId = uuidv4();

        const result = await this.redis.evalsha(
            this.deleteBalanceSha!,
            2,
            balanceKey,
            auditKey,
            operationId,
            timestamp,
            force ? "true" : "false"
        ) as [boolean, string];

        if (!result[0]) {
            throw new BalanceValidationError(result[1]);
        }

        return true;
    }

    async forceDeleteBalance(dbprefix: string): Promise<boolean> {
        return this.deleteBalance(dbprefix, true);
    }
}
