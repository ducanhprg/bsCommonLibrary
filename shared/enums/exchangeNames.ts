export enum ExchangeNames {
    VENDOR_REQUESTS = 'vendor_requests',
    VALIDATOR_REQUESTS = 'validator_requests'
}

export const EXCHANGE_NAME_STATUSES: Record<ExchangeNames, boolean> = {
    [ExchangeNames.VENDOR_REQUESTS]: true,
    [ExchangeNames.VALIDATOR_REQUESTS]: true,
};
