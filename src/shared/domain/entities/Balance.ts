export interface Balance {
    dbprefix: string;
    currentBalance: number;
    availableBalance: number;
    creditLimit: number;
    totalFundAvailable: number;
    pendingTransactionAmount: number;
    version: number; // For optimistic locking
    lastUpdated: Date;
}

export interface BalanceSnapshot extends Balance {
    snapshotId: string;
    createdAt: Date;
}

export enum BalanceField {
    CURRENT_BALANCE = 'current_balance',
    AVAILABLE_BALANCE = 'available_balance',
    CREDIT_LIMIT = 'credit_limit',
    TOTAL_FUND_AVAILABLE = 'total_fund_available',
    PENDING_TRANSACTION_AMOUNT = 'pending_transaction_amount',
    VERSION = 'version',
    LAST_UPDATED = 'last_updated'
}

export enum BalanceOperationType {
    PROGRESS_PAYMENT = 'progress_payment',
    REVERSE_PAYMENT = 'reverse_payment',
    COMPLETE_PAYMENT = 'complete_payment',
    REFUND_PAYMENT = 'refund_payment',
    BALANCE_DEPOSIT = 'balance_deposit',
    BALANCE_WITHDRAWAL = 'balance_withdrawal',
    CREDIT_LIMIT_UPDATE = 'credit_limit_update',
    BALANCE_DELETION = 'balance_deletion'
}

export interface BalanceOperation {
    id: string;
    dbprefix: string;
    operationType: BalanceOperationType;
    amount: number;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export interface BalanceOperationResult {
    success: boolean;
    balance?: Balance;
    error?: string;
    operationId: string;
    retryCount?: number;
}

export class BalanceValidationError extends Error {
    constructor(message: string, public field?: BalanceField) {
        super(message);
        this.name = 'BalanceValidationError';
    }
}

export class InsufficientFundsError extends Error {
    constructor(
        message: string,
        public requestedAmount: number,
        public availableAmount: number
    ) {
        super(message);
        this.name = 'InsufficientFundsError';
    }
}

export class ConcurrencyError extends Error {
    constructor(message: string, public expectedVersion: number, public actualVersion: number) {
        super(message);
        this.name = 'ConcurrencyError';
    }
}
