import { EntitySchema } from 'typeorm';

export interface AccountLedgerInterface {
    id: number;
    trxDate: Date;
    trxTime: string;
    customerBranchId: number;
    txcd: string;
    crdb: 'cr' | 'db'; // Credit or Debit
    currencyCode: string;
    amount: number;
    status: string;
    messages?: string;
    createdAt: Date;
    updatedAt: Date;
}

export const createAccountLedgerEntity = (prefix: string): EntitySchema<AccountLedgerInterface> => {
    return new EntitySchema<AccountLedgerInterface>({
        name: 'AccountLedger',
        tableName: `${prefix}account_ledger`,
        columns: {
            id: {
                type: Number,
                primary: true,
                generated: 'increment'
            },
            trxDate: {
                type: Date,
                name: 'trx_date'
            },
            trxTime: {
                type: String,
                name: 'trx_time',
                length: 8 // HH:mm:ss format
            },
            customerBranchId: {
                type: Number,
                name: 'customer_branch_id'
            },
            txcd: {
                type: String,
                length: 10
            },
            crdb: {
                type: String,
                length: 1
            },
            currencyCode: {
                type: String,
                name: 'currency_code',
                length: 3
            },
            amount: {
                type: 'decimal',
                precision: 15,
                scale: 2
            },
            status: {
                type: String,
                length: 20
            },
            messages: {
                type: String,
                nullable: true
            },
            createdAt: {
                type: Date,
                name: 'created_at',
                createDate: true
            },
            updatedAt: {
                type: Date,
                name: 'updated_at',
                updateDate: true
            }
        },
        indices: [
            {
                name: 'IDX_ACCOUNT_LEDGER_TRX_DATE',
                columns: ['trxDate']
            },
            {
                name: 'IDX_ACCOUNT_LEDGER_CUSTOMER_BRANCH',
                columns: ['customerBranchId']
            },
            {
                name: 'IDX_ACCOUNT_LEDGER_STATUS',
                columns: ['status']
            }
        ]
    });
}; 