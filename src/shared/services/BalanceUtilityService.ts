import { DataSource, Repository } from 'typeorm';
import {
    Balance,
    BalanceOperation,
    BalanceOperationResult,
    BalanceValidationError
} from '@shared/domain/entities/Balance';
import { BalanceRepositoryInterface } from '@shared/domain/interfaces/BalanceRepositoryInterface';
import { getTenantDataSource } from '@shared/configs/mysqlConfig';
import { AccountBalanceInterface, createAccountBalanceEntity } from '@shared/database/multi-tenant/entities/AccountBalance';
import { AccountLedgerInterface, createAccountLedgerEntity } from '@shared/database/multi-tenant/entities/AccountLedger';
import { Logger } from '@shared/logging/Logger';

export class BalanceUtilityService {
    private repository: BalanceRepositoryInterface;
    private accountBalanceRepo: Repository<AccountBalanceInterface> | null = null;
    private accountLedgerRepo: Repository<AccountLedgerInterface> | null = null;
    private dataSource: DataSource | null = null;

    constructor(
        repository: BalanceRepositoryInterface,
        private readonly tenantDatabasePrefix?: string,
        private readonly tenantDatabaseName?: string
    ) {
        this.repository = repository;
    }

    async initializeBalance(dbprefix: string, database: string): Promise<Balance> {
        let balanceInfo;
        try {
            balanceInfo = await this.getAccountLatestOpeningBalance(dbprefix, database);
        } catch (error) {
            Logger.error(`[BalanceUtilityService] Error fetching opening balance for ${dbprefix}:`, error);
            throw new Error(`Failed to fetch opening balance for account ${dbprefix}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        if (!balanceInfo) {
            Logger.error(`[BalanceUtilityService] No opening balance record found for account: ${dbprefix}`);
            throw new Error(`No opening balance found for account: ${dbprefix}. Please ensure the account has been properly set up with an opening balance record.`);
        }

        // Get total credit and debit amounts for all transactions after the report_date
        let creditAmount = 0;
        let debitAmount = 0;
        
        try {
            creditAmount = await this.getTransactionSumAfterDate('cr', balanceInfo.report_date, balanceInfo.customer_branch_id, dbprefix, database) || 0;
        } catch (error) {
            Logger.error(`[BalanceUtilityService] Error fetching credit transactions for ${dbprefix}:`, error);
            throw new Error(`Failed to calculate credit transactions for account ${dbprefix}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        try {
            debitAmount = await this.getTransactionSumAfterDate('db', balanceInfo.report_date, balanceInfo.customer_branch_id, dbprefix, database) || 0;
        } catch (error) {
            Logger.error(`[BalanceUtilityService] Error fetching debit transactions for ${dbprefix}:`, error);
            throw new Error(`Failed to calculate debit transactions for account ${dbprefix}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Calculate final balance: opening_balance - credit + debit
        const finalBalance = balanceInfo.opening_balance - creditAmount + debitAmount;
        
        // Validate calculated balance
        if (isNaN(finalBalance) || !isFinite(finalBalance)) {
            Logger.error(`[BalanceUtilityService] Invalid calculated balance for ${dbprefix}:`, {
                openingBalance: balanceInfo.opening_balance,
                creditAmount,
                debitAmount,
                calculatedBalance: finalBalance
            });
            throw new Error(`Invalid balance calculation result: ${finalBalance}. Please check opening balance and transaction data.`);
        }

        const totalFundAvailable = finalBalance + balanceInfo.credit_limit;

        const balance: Balance = {
            dbprefix: dbprefix,
            currentBalance: finalBalance,
            availableBalance: finalBalance,
            creditLimit: balanceInfo.credit_limit,
            totalFundAvailable: totalFundAvailable,
            pendingTransactionAmount: 0,
            version: 0,
            lastUpdated: new Date()
        };

        const createdBalance = await this.repository.createBalance(balance);
        
        return createdBalance;
    }

    async getBalance(dbprefix: string): Promise<Balance> {
        const balance = await this.repository.getBalance(dbprefix);
        if (!balance) {
            throw new BalanceValidationError('Balance not found for user');
        }
        return balance;
    }

    async executeTransaction(operations: Omit<BalanceOperation, 'id' | 'timestamp'>[]): Promise<BalanceOperationResult[]> {
        const { v4: uuidv4 } = await import('uuid');
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

    validateAmount(amount: number): void {
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
            Logger.error(`[BalanceUtilityService] Database error fetching opening balance:`, {
                dbprefix,
                database,
                tableName: `${dbprefix}account_balance`,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
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
            Logger.error('Error fetching transaction sum by date:', error);
            throw new Error(`Failed to fetch transaction sum: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async getTransactionSumAfterDate(
        crdb: 'cr' | 'db',
        date: string,
        customerBranchId: string,
        dbprefix: string,
        database: string
    ): Promise<number> {
        try {
            const { accountLedgerRepo } = await this.getRepositories(dbprefix, database);

            // Use QueryBuilder for complex aggregation with date filtering
            const query = accountLedgerRepo
                .createQueryBuilder('ledger')
                .select('COALESCE(SUM(ledger.amount), 0)', 'total')
                .where('ledger.customerBranchId = :customerBranchId', { customerBranchId: parseInt(customerBranchId) })
                .andWhere('ledger.crdb = :crdb', { crdb })
                .andWhere('ledger.trxDate > :date', { date })
                .andWhere('ledger.status = :status', { status: '1' });
            
            const result = await query.getRawOne();
            const total = parseFloat(result?.total) || 0;

            return total;
        } catch (error) {
            Logger.error(`[BalanceUtilityService] Database error fetching ${crdb === 'cr' ? 'credit' : 'debit'} transaction sum:`, {
                customerBranchId,
                dbprefix,
                database,
                tableName: `${dbprefix}account_ledger`,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
}
