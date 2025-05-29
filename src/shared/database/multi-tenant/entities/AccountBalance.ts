import { EntitySchema } from 'typeorm';

export interface AccountBalanceInterface {
    id: number;
    reportDate: Date;
    openingBalance: number;
    creditLimit: number;
    customerBranchId: string;
    status: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export const createAccountBalanceEntity = (prefix: string): EntitySchema<AccountBalanceInterface> => {
    return new EntitySchema<AccountBalanceInterface>({
        name: 'AccountBalance',
        tableName: `${prefix}account_balance`,
        columns: {
            id: {
                type: Number,
                primary: true,
                generated: 'increment'
            },
            reportDate: {
                type: Date,
                name: 'report_date'
            },
            openingBalance: {
                type: 'decimal',
                precision: 15,
                scale: 2,
                name: 'opening_balance'
            },
            creditLimit: {
                type: 'decimal',
                precision: 15,
                scale: 2,
                name: 'credit_limit'
            },
            customerBranchId: {
                type: String,
                name: 'customer_branch_id'
            },
            status: {
                type: Number,
                default: 1
            },
            createdAt: {
                type: Date,
                name: 'created_at',
                createDate: true,
                nullable: true
            },
            updatedAt: {
                type: Date,
                name: 'updated_at',
                updateDate: true,
                nullable: true
            }
        },
        indices: [
            {
                name: 'IDX_ACCOUNT_BALANCE_REPORT_DATE',
                columns: ['reportDate']
            },
            {
                name: 'IDX_ACCOUNT_BALANCE_CUSTOMER_BRANCH',
                columns: ['customerBranchId']
            },
            {
                name: 'IDX_ACCOUNT_BALANCE_STATUS',
                columns: ['status']
            }
        ]
    });
};
