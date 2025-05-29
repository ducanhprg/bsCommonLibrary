import { v4 as uuidv4 } from 'uuid';
import { DataSource, Repository } from 'typeorm';
import {
    Balance,
    BalanceOperation,
    BalanceOperationResult,
    BalanceOperationType,
    BalanceValidationError
} from '@shared/domain/entities/Balance';
import { BalanceRepositoryInterface } from '@shared/domain/interfaces/BalanceRepositoryInterface';
import { getTenantDataSource } from '@shared/configs/mysqlConfig';
import { AccountBalanceInterface, createAccountBalanceEntity } from '@shared/database/multi-tenant/entities/AccountBalance';
import { AccountLedgerInterface, createAccountLedgerEntity } from '@shared/database/multi-tenant/entities/AccountLedger';

export interface BalanceServiceConfig {
    maxRetries?: number;
    retryDelayMs?: number;
    defaultCreditLimit?: number;
}

export class BalanceService {
    private repository: BalanceRepositoryInterface;
    private config: Required<BalanceServiceConfig>;
    private accountBalanceRepo: Repository<AccountBalanceInterface> | null = null;
    private accountLedgerRepo: Repository<AccountLedgerInterface> | null = null;
    private dataSource: DataSource | null = null;

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
    }

    async initializeBalance(dbprefix: string, database: string): Promise<Balance> {
        const balanceInfo = await this.getAccountLatestOpeningBalance(dbprefix, database);

        if (!balanceInfo) {
            throw new Error('No opening balance found for the account');
        }

        const startDate = new Date(balanceInfo.report_date);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const processingDate = new Date(startDate);
        let finalBalance = balanceInfo.opening_balance;

        while (processingDate <= yesterday) {
            const dateStr = processingDate.toISOString().split('T')[0];

            const creditAmount = await this.getTransactionSumByDate('cr', dateStr, balanceInfo.customer_branch_id, dbprefix, database) || 0;
            const debitAmount = await this.getTransactionSumByDate('db', dateStr, balanceInfo.customer_branch_id, dbprefix, database) || 0;

            finalBalance = finalBalance - creditAmount + debitAmount;

            processingDate.setDate(processingDate.getDate() + 1);
        }

        const balance: Balance = {
            dbprefix: dbprefix,
            currentBalance: finalBalance,
            availableBalance: finalBalance,
            creditLimit: balanceInfo.credit_limit,
            totalFundAvailable: finalBalance + balanceInfo.credit_limit,
            pendingTransactionAmount: 0,
            version: 0,
            lastUpdated: new Date()
        };

        return await this.repository.createBalance(balance);
    }


    async getBalance(dbprefix: string): Promise<Balance> {
        const balance = await this.repository.getBalance(dbprefix);
        if (!balance) {
            throw new BalanceValidationError('Balance not found for user');
        }
        return balance;
    }


    async progressPayment(dbprefix: string, database: string, amount: number, metadata?: Record<string, any>): Promise<boolean> {
        this.validateAmount(amount);

        let existingBalance = await this.repository.getBalance(dbprefix);

        if (!existingBalance) {
            try {
                await this.initializeBalance(dbprefix, database);
                existingBalance = await this.repository.getBalance(dbprefix);
            } catch (error) {
                throw new Error(`Failed to initialize balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        if (!existingBalance) {
            throw new Error('Balance not found after initialization');
        }

        if (amount > existingBalance.totalFundAvailable) {
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
        this.validateAmount(amount);

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
        this.validateAmount(amount);

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
        this.validateAmount(amount);

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


    async executeTransaction(operations: Omit<BalanceOperation, 'id' | 'timestamp'>[]): Promise<BalanceOperationResult[]> {
        const fullOperations: BalanceOperation[] = operations.map(op => ({
            ...op,
            id: uuidv4(),
            timestamp: new Date()
        }));

        fullOperations.forEach(op => this.validateAmount(op.amount));

        return await this.repository.executeTransaction(fullOperations);
    }


    async getOperationHistory(dbprefix: string, limit?: number): Promise<BalanceOperation[]> {
        return await this.repository.getOperationHistory(dbprefix, limit);
    }


    async createSnapshot(dbprefix: string) {
        return await this.repository.createSnapshot(dbprefix);
    }


    async checkSufficientFunds(dbprefix: string, amount: number): Promise<boolean> {
        const balance = await this.getBalance(dbprefix);
        return balance.availableBalance >= amount;
    }


    async getAvailableFunds(dbprefix: string): Promise<number> {
        const balance = await this.getBalance(dbprefix);
        return balance.availableBalance;
    }


    async updateCreditLimit(_dbprefix: string, newCreditLimit: number): Promise<Balance> {
        if (newCreditLimit < 0) {
            throw new BalanceValidationError('Credit limit cannot be negative');
        }

        throw new Error('Credit limit updates require a separate implementation');
    }

    private validateAmount(amount: number): void {
        if (amount <= 0) {
            throw new BalanceValidationError('Amount must be positive');
        }
        if (!Number.isFinite(amount)) {
            throw new BalanceValidationError('Amount must be a valid number');
        }
        if (amount > Number.MAX_SAFE_INTEGER) {
            throw new BalanceValidationError('Amount is too large');
        }
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

    private async getRepositories(dbprefix: string, database: string): Promise<{
        accountBalanceRepo: Repository<AccountBalanceInterface>;
        accountLedgerRepo: Repository<AccountLedgerInterface>;
    }> {
        if (!this.accountBalanceRepo || !this.accountLedgerRepo) {
            const accountBalanceEntity = createAccountBalanceEntity(dbprefix);
            const accountLedgerEntity = createAccountLedgerEntity(dbprefix);

            const baseDataSource = await getTenantDataSource(database);

            this.dataSource = new DataSource({
                ...baseDataSource.options,
                entities: [
                    accountBalanceEntity,
                    accountLedgerEntity
                ]
            });

            if (!this.dataSource.isInitialized) {
                await this.dataSource.initialize();
            }

            this.accountBalanceRepo = this.dataSource.getRepository(accountBalanceEntity);
            this.accountLedgerRepo = this.dataSource.getRepository(accountLedgerEntity);
        }

        return {
            accountBalanceRepo: this.accountBalanceRepo,
            accountLedgerRepo: this.accountLedgerRepo
        };
    }

    private async getAccountLatestOpeningBalance(dbprefix: string, database: string): Promise<{
        report_date: string;
        opening_balance: number;
        credit_limit: number;
        customer_branch_id: string;
    } | null> {
        try {
            const { accountBalanceRepo } = await this.getRepositories(dbprefix, database);

            const record = await accountBalanceRepo.findOne({
                where: { status: 1 },
                order: { reportDate: 'DESC' }
            });

            if (!record) {
                return null;
            }

            return {
                report_date: record.reportDate.toISOString().split('T')[0],
                opening_balance: parseFloat(record.openingBalance.toString()) || 0,
                credit_limit: parseFloat(record.creditLimit.toString()) || 0,
                customer_branch_id: record.customerBranchId
            };
        } catch (error) {
            console.error('Error fetching account latest opening balance:', error);
            throw new Error(`Failed to fetch account opening balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async getTransactionSumByDate(
        crdb: 'cr' | 'db',
        date: string,
        customerBranchId: string,
        dbprefix: string,
        database: string
    ): Promise<number> {
        try {
            const { accountLedgerRepo } = await this.getRepositories(dbprefix, database);

            // Parse the date string to create a Date object for the start and end of the day
            const targetDate = new Date(date);
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);

            // Use QueryBuilder for complex aggregation with date filtering
            const result = await accountLedgerRepo
                .createQueryBuilder('ledger')
                .select('COALESCE(SUM(ledger.amount), 0)', 'total')
                .where('ledger.customerBranchId = :customerBranchId', { customerBranchId: parseInt(customerBranchId) })
                .andWhere('ledger.crdb = :crdb', { crdb })
                .andWhere('DATE(ledger.trxDate) = :date', { date })
                .andWhere('ledger.status = :status', { status: '1' })
                .getRawOne();

            return parseFloat(result?.total) || 0;
        } catch (error) {
            console.error('Error fetching transaction sum by date:', error);
            throw new Error(`Failed to fetch transaction sum: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
