import { v4 as uuidv4 } from 'uuid';
import {
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
    cleanupRetryDelayMs?: number; // Delay when cleanup operations are detected
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
            cleanupRetryDelayMs: config.cleanupRetryDelayMs ?? 2000
        };
        this.utilityService = new BalanceUtilityService(repository, tenantDatabasePrefix, tenantDatabaseName);
    }

    async progressPayment(dbprefix: string, database: string, amount: number, metadata?: Record<string, any>): Promise<boolean> {
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
            '', // database not needed for reverse operations
            amount,
            BalanceOperationType.REVERSE_PAYMENT,
            metadata,
            false // doesn't require initialization
        );
    }

    async completePayment(dbprefix: string, amount: number, metadata?: Record<string, any>): Promise<boolean> {
        return await this.executeBalanceOperation(
            dbprefix,
            '', // database not needed for complete operations
            amount,
            BalanceOperationType.COMPLETE_PAYMENT,
            metadata,
            false // doesn't require initialization
        );
    }

    async refundPayment(dbprefix: string, amount: number, metadata?: Record<string, any>): Promise<boolean> {
        return await this.executeBalanceOperation(
            dbprefix,
            '', // database not needed for refund operations
            amount,
            BalanceOperationType.REFUND_PAYMENT,
            metadata,
            false // doesn't require initialization
        );
    }

    private async executeBalanceOperation(
        dbprefix: string,
        database: string,
        amount: number,
        operationType: BalanceOperationType,
        metadata?: Record<string, any>,
        requiresInitialization: boolean = false
    ): Promise<boolean> {
        this.utilityService.validateAmount(amount);

        let existingBalance = await this.repository.getBalance(dbprefix);

        // Handle balance initialization with cleanup-aware logic
        if (!existingBalance && requiresInitialization) {
            try {
                await this.utilityService.initializeBalance(dbprefix, database);
                existingBalance = await this.repository.getBalance(dbprefix);
            } catch (error) {
                // If initialization fails, it might be due to cleanup operations
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                if (this.isCleanupRelatedError(errorMessage)) {
                    // Wait for cleanup to complete and retry
                    await this.delay(this.config.cleanupRetryDelayMs);
                    try {
                        await this.utilityService.initializeBalance(dbprefix, database);
                        existingBalance = await this.repository.getBalance(dbprefix);
                    } catch (retryError) {
                        throw new Error(`Failed to initialize balance after cleanup: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`);
                    }
                } else {
                    throw new Error(`Failed to initialize balance: ${errorMessage}`);
                }
            }
        }

        if (!existingBalance) {
            throw new Error('Balance not found after initialization');
        }

        // Check funds availability for payment progress operations
        if (operationType === BalanceOperationType.PROGRESS_PAYMENT && amount > existingBalance.totalFundAvailable) {
            console.log('Insufficient funds', [
                existingBalance.totalFundAvailable,
                amount
            ]);
            return false;
        }

        const operation: BalanceOperation = {
            id: uuidv4(),
            dbprefix: dbprefix,
            operationType,
            amount,
            timestamp: new Date(),
            metadata
        };

        const result = await this.executeWithRetry(operation);

        if (!result.success) {
            throw new Error(result.error || `${operationType} operation failed`);
        }

        // Schedule cleanup if needed (this runs asynchronously and won't block)
        await this.scheduleCleanupIfNeeded(dbprefix, result.balance);

        return true;
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

                // If it's a cleanup-related error, use longer delay
                const delay = this.isCleanupRelatedError(lastError) 
                    ? this.config.cleanupRetryDelayMs 
                    : this.config.retryDelayMs * Math.pow(2, attempt);

                if (attempt < this.config.maxRetries) {
                    await this.delay(delay);
                }

            } catch (error) {
                lastError = error instanceof Error ? error.message : 'Unknown error';

                // If it's a cleanup-related error, use longer delay
                const delay = this.isCleanupRelatedError(lastError) 
                    ? this.config.cleanupRetryDelayMs 
                    : this.config.retryDelayMs * Math.pow(2, attempt);

                if (attempt < this.config.maxRetries) {
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

    private isCleanupRelatedError(error: string): boolean {
        return error.includes('cleanup') || 
               error.includes('lock') || 
               error.includes('Balance not found') ||
               error.includes('initialization');
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
                console.error(`Failed to schedule cleanup for ${dbprefix}:`, error);
                // Don't throw here - cleanup scheduling failures shouldn't block main operations
            }
        }
    }

}
