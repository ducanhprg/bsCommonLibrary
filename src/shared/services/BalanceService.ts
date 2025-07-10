import { v4 as uuidv4 } from 'uuid';
import {
    Balance,
    BalanceOperation,
    BalanceOperationResult,
    BalanceOperationType
} from '@shared/domain/entities/Balance';
import { BalanceRepositoryInterface } from '@shared/domain/interfaces/BalanceRepositoryInterface';
import { BalanceUtilityService } from './BalanceUtilityService';
import { BalanceCleanupService } from './BalanceCleanupService';

export interface BalanceServiceConfig {
    maxRetries?: number;
    retryDelayMs?: number;
    defaultCreditLimit?: number;
    maxRetryDelayMs?: number; // Maximum delay cap for exponential backoff
}

export class BalanceService {
    private repository: BalanceRepositoryInterface;
    private config: Required<BalanceServiceConfig>;
    private utilityService: BalanceUtilityService;

    constructor(
        repository: BalanceRepositoryInterface,
        config: BalanceServiceConfig = {},
        private readonly tenantDatabasePrefix?: string,
        private readonly tenantDatabaseName?: string,
        private readonly cleanupService?: BalanceCleanupService
    ) {
        this.repository = repository;
        this.config = {
            maxRetries: config.maxRetries ?? 3,
            retryDelayMs: config.retryDelayMs ?? 100,
            defaultCreditLimit: config.defaultCreditLimit ?? 0,
            maxRetryDelayMs: config.maxRetryDelayMs ?? 5000 // Cap at 5 seconds
        };
        this.utilityService = new BalanceUtilityService(repository, tenantDatabasePrefix, tenantDatabaseName);
    }

    async progressPayment(dbprefix: string, database: string, amount: number, metadata?: Record<string, any>): Promise<boolean> {
        // Validate required parameters
        if (!database || database.trim() === '') {
            throw new Error('Database parameter is required for progress payment operations');
        }

        return await this.executeBalanceOperation(
            dbprefix,
            database,
            amount,
            BalanceOperationType.PROGRESS_PAYMENT,
            metadata,
            true // requiresInitialization
        );
    }

    async reversePayment(dbprefix: string, amount: number, metadata?: Record<string, any>): Promise<boolean> {
        return await this.executeBalanceOperation(
            dbprefix,
            this.tenantDatabaseName || '', // Use tenant database name or empty string
            amount,
            BalanceOperationType.REVERSE_PAYMENT,
            metadata,
            false // doesn't require initialization
        );
    }

    async completePayment(dbprefix: string, amount: number, metadata?: Record<string, any>): Promise<boolean> {
        return await this.executeBalanceOperation(
            dbprefix,
            this.tenantDatabaseName || '', // Use tenant database name or empty string
            amount,
            BalanceOperationType.COMPLETE_PAYMENT,
            metadata,
            false // doesn't require initialization
        );
    }

    async refundPayment(dbprefix: string, amount: number, metadata?: Record<string, any>): Promise<boolean> {
        return await this.executeBalanceOperation(
            dbprefix,
            this.tenantDatabaseName || '', // Use tenant database name or empty string
            amount,
            BalanceOperationType.REFUND_PAYMENT,
            metadata,
            false // doesn't require initialization
        );
    }

    async getBalance(dbprefix: string): Promise<Balance> {
        if (!dbprefix || dbprefix.trim() === '') {
            throw new Error('Database prefix is required');
        }

        const balance = await this.repository.getBalance(dbprefix);
        
        if (!balance) {
            throw new Error(`Balance not found for user: ${dbprefix}`);
        }

        return balance;
    }

    async updateBalance(dbprefix: string, amount: number, metadata?: Record<string, any>): Promise<Balance> {
        if (!dbprefix || dbprefix.trim() === '') {
            throw new Error('Database prefix is required');
        }

        this.utilityService.validateAmount(Math.abs(amount));

        return await this.repository.updateBalance(dbprefix, amount, metadata);
    }

    async updateCreditLimit(dbprefix: string, amount: number, metadata?: Record<string, any>): Promise<Balance> {

        if (!dbprefix || dbprefix.trim() === '') {
            throw new Error('Database prefix is required');
        }

        this.utilityService.validateAmount(Math.abs(amount));
        
        return await this.repository.updateCreditLimit(dbprefix, amount, metadata);
    }

    async reinitializeBalance(dbprefix: string, database: string, metadata?: Record<string, any>): Promise<Balance> {
        // Validate input parameters
        if (!dbprefix || dbprefix.trim() === '') {
            throw new Error('Database prefix is required');
        }

        if (!database || database.trim() === '') {
            throw new Error('Database parameter is required for balance reinitialization');
        }

        // Get current balance to check pending transactions
        const currentBalance = await this.repository.getBalance(dbprefix);
        if (!currentBalance) {
            throw new Error(`Balance not found for user: ${dbprefix}`);
        }

        // Check if there are any pending transactions
        if (currentBalance.pendingTransactionAmount > 0) {
            throw new Error(
                `Cannot reinitialize balance with pending transactions. ` +
                `Pending amount: ${currentBalance.pendingTransactionAmount}. ` +
                `Please complete or reverse all pending transactions before reinitializing.`
            );
        }

        try {
            // Delete the existing balance to allow reinitialization
            await this.repository.deleteBalance(dbprefix);

            // Use the utility service to initialize the balance
            const reinitializedBalance = await this.utilityService.initializeBalance(dbprefix, database);

            // Log the reinitialization for audit purposes
            console.log(`Balance reinitialized for user: ${dbprefix}`, {
                previousBalance: currentBalance.currentBalance,
                newBalance: reinitializedBalance.currentBalance,
                previousCreditLimit: currentBalance.creditLimit,
                newCreditLimit: reinitializedBalance.creditLimit,
                metadata
            });

            return reinitializedBalance;
        } catch (error) {
            throw new Error(`Failed to reinitialize balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async executeBalanceOperation(
        dbprefix: string,
        database: string,
        amount: number,
        operationType: BalanceOperationType,
        metadata?: Record<string, any>,
        requiresInitialization: boolean = false
    ): Promise<boolean> {
        // Validate input parameters
        if (!dbprefix || dbprefix.trim() === '') {
            throw new Error('Database prefix is required');
        }

        this.utilityService.validateAmount(amount);

        let existingBalance = await this.repository.getBalance(dbprefix);

        // Handle balance initialization if needed
        if (!existingBalance) {
            if (requiresInitialization) {
                if (!database || database.trim() === '') {
                    throw new Error('Database parameter is required for balance initialization');
                }
                try {
                    await this.utilityService.initializeBalance(dbprefix, database);
                    existingBalance = await this.repository.getBalance(dbprefix);
                } catch (error) {
                    throw new Error(`Failed to initialize balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            } else {
                throw new Error(`Balance not found for user: ${dbprefix}. Please initialize balance first.`);
            }
        }

        if (!existingBalance) {
            throw new Error('Balance not found after initialization');
        }

        // Validate balance for all operations
        const validationResult = this.validateBalanceForOperation(operationType, amount, existingBalance);
        if (!validationResult.isValid) {
            console.log(`Operation validation failed: ${validationResult.reason}`, {
                operationType,
                amount,
                currentBalance: existingBalance.currentBalance,
                availableBalance: existingBalance.availableBalance,
                totalFundAvailable: existingBalance.totalFundAvailable,
                pendingTransactionAmount: existingBalance.pendingTransactionAmount
            });
            return false;
        }

        const operation: BalanceOperation = {
            id: uuidv4(),
            dbprefix: dbprefix,
            operationType,
            amount,
            timestamp: new Date(), // Fresh timestamp for each operation
            metadata
        };

        const result = await this.executeWithRetry(operation);

        if (!result.success) {
            throw new Error(result.error || `${operationType} operation failed`);
        }

        // Schedule cleanup asynchronously to not block the main operation
        this.scheduleCleanupIfNeeded(dbprefix, result.balance).catch(error => {
            console.error(`Failed to schedule cleanup for ${dbprefix}:`, error);
        });

        return true;
    }

    private validateBalanceForOperation(
        operationType: BalanceOperationType,
        amount: number,
        balance: any
    ): { isValid: boolean; reason?: string } {
        switch (operationType) {
            case BalanceOperationType.PROGRESS_PAYMENT:
                if (amount > balance.totalFundAvailable) {
                    return {
                        isValid: false,
                        reason: `Insufficient funds: requested ${amount}, available ${balance.totalFundAvailable}`
                    };
                }
                break;

            case BalanceOperationType.COMPLETE_PAYMENT:
                if (amount > balance.pendingTransactionAmount) {
                    return {
                        isValid: false,
                        reason: `Insufficient pending amount: requested ${amount}, pending ${balance.pendingTransactionAmount}`
                    };
                }
                break;

            case BalanceOperationType.REVERSE_PAYMENT:
                if (amount > balance.pendingTransactionAmount) {
                    return {
                        isValid: false,
                        reason: `Insufficient pending amount to reverse: requested ${amount}, pending ${balance.pendingTransactionAmount}`
                    };
                }
                break;

            case BalanceOperationType.REFUND_PAYMENT:
                if (amount > balance.pendingTransactionAmount) {
                    return {
                        isValid: false,
                        reason: `Insufficient pending amount to refund: requested ${amount}, pending ${balance.pendingTransactionAmount}`
                    };
                }
                break;

            default:
                return {
                    isValid: false,
                    reason: `Unknown operation type: ${operationType}`
                };
        }

        return { isValid: true };
    }

    private async executeWithRetry(operation: BalanceOperation): Promise<BalanceOperationResult> {
        let lastError: string = '';

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                const result = await this.repository.executeOperation(operation);

                if (result.success) {
                    return { ...result, retryCount: attempt };
                }

                lastError = result.error || 'Unknown error';

                // Don't retry for business logic errors
                if (lastError.includes('Insufficient') || lastError.includes('Invalid')) {
                    return result;
                }

                // Use exponential backoff for retries with maximum delay cap
                if (attempt < this.config.maxRetries) {
                    const delay = Math.min(
                        this.config.retryDelayMs * Math.pow(2, attempt),
                        this.config.maxRetryDelayMs
                    );
                    await this.delay(delay);
                }

            } catch (error) {
                lastError = error instanceof Error ? error.message : 'Unknown error';

                // Use exponential backoff for retries with maximum delay cap
                if (attempt < this.config.maxRetries) {
                    const delay = Math.min(
                        this.config.retryDelayMs * Math.pow(2, attempt),
                        this.config.maxRetryDelayMs
                    );
                    await this.delay(delay);
                }
            }
        }

        return {
            success: false,
            error: `Operation failed after ${this.config.maxRetries + 1} attempts: ${lastError}`,
            operationId: operation.id,
            retryCount: this.config.maxRetries
        };
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async scheduleCleanupIfNeeded(dbprefix: string, balance?: any): Promise<void> {
        if (this.cleanupService && balance) {
            try {
                await this.cleanupService.scheduleCleanupIfNeeded(
                    dbprefix, 
                    balance.pendingTransactionAmount ?? 0
                );
            } catch (error) {
                // Log but don't throw - cleanup scheduling failures shouldn't block main operations
                console.error(`Failed to schedule cleanup for ${dbprefix}:`, error);
            }
        }
    }



}
