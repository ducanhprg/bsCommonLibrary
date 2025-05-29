import { Balance, BalanceOperation, BalanceOperationResult, BalanceSnapshot } from '../entities/Balance';

export interface BalanceRepositoryInterface {
    /**
     * Get balance for a user
     */
    getBalance(dbprefix: string): Promise<Balance | null>;

    /**
     * Create initial balance for a user
     */
    createBalance(balance: Balance): Promise<Balance>;

    /**
     * Execute a balance operation atomically
     */
    executeOperation(operation: BalanceOperation): Promise<BalanceOperationResult>;

    /**
     * Execute multiple operations in a transaction
     */
    executeTransaction(operations: BalanceOperation[]): Promise<BalanceOperationResult[]>;

    /**
     * Get operation history for a user
     */
    getOperationHistory(dbprefix: string, limit?: number): Promise<BalanceOperation[]>;

    /**
     * Create a balance snapshot for audit purposes
     */
    createSnapshot(dbprefix: string): Promise<BalanceSnapshot>;

    /**
     * Check if user exists
     */
    exists(dbprefix: string): Promise<boolean>;

    /**
     * Lock balance for exclusive access
     */
    lockBalance(dbprefix: string, timeoutMs?: number): Promise<string | null>;

    /**
     * Release balance lock
     */
    releaseLock(dbprefix: string, lockId: string): Promise<boolean>;
}
