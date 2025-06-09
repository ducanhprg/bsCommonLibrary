export enum ExchangeNames {
    VENDOR_REQUESTS = 'vendor_requests',
    VALIDATOR_REQUESTS = 'validator_requests',
    CONSOLIDATOR_REQUESTS = 'consolidator_requests',
    CONSOLIDATOR_RESPONSE = 'consolidator_response',
    SYNC_MANAGER_REQUESTS = 'sync_manager_requests'
}

export const EXCHANGE_NAME_STATUSES: Record<ExchangeNames, boolean> = {
    [ExchangeNames.VENDOR_REQUESTS]: true,
    [ExchangeNames.VALIDATOR_REQUESTS]: true,
    [ExchangeNames.CONSOLIDATOR_REQUESTS]: true,
    [ExchangeNames.CONSOLIDATOR_RESPONSE]: true,
    [ExchangeNames.SYNC_MANAGER_REQUESTS]: true
};
