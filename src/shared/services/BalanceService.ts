import { v4 as uuidv4 } from 'uuid';
import {
    BalanceOperation,
    BalanceOperationResult,
    BalanceOperationType
} from '@shared/domain/entities/Balance';
import { BalanceRepositoryInterface } from '@shared/domain/interfaces/BalanceRepositoryInterface';
import { BalanceUtilityService } from './BalanceUtilityService';

export interface BalanceServiceConfig {
    maxRetries?: number;
    retryDelayMs?: number;
    defaultCreditLimit?: number;
}

export class BalanceService {
    private repository: BalanceRepositoryInterface;
    private config: Required<BalanceServiceConfig>;
    private utilityService: BalanceUtilityService;

    constructor(
        repository: BalanceRepositoryInterface,
        config: BalanceServiceConfig = {},
        private readonly tenantDatabasePrefix?: string,
        private readonly tenantDatabaseName?: string
    ) {
        this.repository = repository;
        this.config = {
            maxRetries: config.maxRetries ?? 3,
            retryDelayMs: config.retryDelayMs ?? 100,
            defaultCreditLimit: config.defaultCreditLimit ?? 0
        };
        this.utilityService = new BalanceUtilityService(repository, tenantDatabasePrefix, tenantDatabaseName);
    }

    async progressPayment(dbprefix: string, database: string, amount: number, metadata?: Record<string, any>): Promise<boolean> {
        this.utilityService.validateAmount(amount);

        let existingBalance = await this.repository.getBalance(dbprefix);

        if (!existingBalance) {
            try {
                await this.utilityService.initializeBalance(dbprefix, database);
                existingBalance = await this.repository.getBalance(dbprefix);
            } catch (error) {
                throw new Error(`Failed to initialize balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        if (!existingBalance) {
            throw new Error('Balance not found after initialization');
        }

        if (amount > existingBalance.totalFundAvailable) {
            console.log('Insufficient funds', [
                existingBalance.totalFundAvailable,
                amount,
                existingBalance.availableBalance,
                existingBalance.creditLimit,
                existingBalance.currentBalance,
                existingBalance.pendingTransactionAmount,
                existingBalance.version
            ]);
            return false;
        }

        const operation: BalanceOperation = {
            id: uuidv4(),
            dbprefix: dbprefix,
            operationType: BalanceOperationType.PROGRESS_PAYMENT,
            amount,
            timestamp: new Date(),
            metadata
        };

        const result = await this.executeWithRetry(operation);

        if (!result.success) {
            throw new Error(result.error || 'Progress payment operation failed');
        }

        return true;
    }

    async reversePayment(dbprefix: string, amount: number, metadata?: Record<string, any>): Promise<boolean> {
        this.utilityService.validateAmount(amount);

        const operation: BalanceOperation = {
            id: uuidv4(),
            dbprefix: dbprefix,
            operationType: BalanceOperationType.REVERSE_PAYMENT,
            amount,
            timestamp: new Date(),
            metadata
        };

        const result = await this.executeWithRetry(operation);

        if (!result.success) {
            throw new Error(result.error || 'Reverse payment operation failed');
        }

        return true;
    }

    async completePayment(dbprefix: string, amount: number, metadata?: Record<string, any>): Promise<boolean> {
        this.utilityService.validateAmount(amount);

        const operation: BalanceOperation = {
            id: uuidv4(),
            dbprefix: dbprefix,
            operationType: BalanceOperationType.COMPLETE_PAYMENT,
            amount,
            timestamp: new Date(),
            metadata
        };

        const result = await this.executeWithRetry(operation);

        if (!result.success) {
            throw new Error(result.error || 'Complete payment operation failed');
        }

        return true;
    }

    async refundPayment(dbprefix: string, amount: number, metadata?: Record<string, any>): Promise<boolean> {
        this.utilityService.validateAmount(amount);

        const operation: BalanceOperation = {
            id: uuidv4(),
            dbprefix: dbprefix,
            operationType: BalanceOperationType.REFUND_PAYMENT,
            amount,
            timestamp: new Date(),
            metadata
        };

        const result = await this.executeWithRetry(operation);

        if (!result.success) {
            throw new Error(result.error || 'Refund payment operation failed');
        }

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

                if (lastError.includes('Insufficient') || lastError.includes('Invalid')) {
                    return result;
                }

                if (attempt < this.config.maxRetries) {
                    await this.delay(this.config.retryDelayMs * Math.pow(2, attempt));
                }

            } catch (error) {
                lastError = error instanceof Error ? error.message : 'Unknown error';

                if (attempt < this.config.maxRetries) {
                    await this.delay(this.config.retryDelayMs * Math.pow(2, attempt));
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

}
