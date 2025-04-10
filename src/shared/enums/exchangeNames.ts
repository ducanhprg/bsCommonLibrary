export enum ExchangeNames {
    VENDOR_REQUESTS = 'vendor_requests',
    VALIDATOR_REQUESTS = 'validator_requests',
    CONSOLIDATOR_REQUESTS = 'consolidator_requests',
    CONSOLIDATOR_RESPONSE = 'consolidator_response',
    MONOLITH_REQUESTS = 'monolith_requests',
    MONOLITH_RESPONSE = 'monolith_response'

}

export const EXCHANGE_NAME_STATUSES: Record<ExchangeNames, boolean> = {
    [ExchangeNames.VENDOR_REQUESTS]: true,
    [ExchangeNames.VALIDATOR_REQUESTS]: true,
    [ExchangeNames.CONSOLIDATOR_REQUESTS]: true,
    [ExchangeNames.CONSOLIDATOR_RESPONSE]: true,
    [ExchangeNames.MONOLITH_REQUESTS]: true,
    [ExchangeNames.MONOLITH_RESPONSE]: true
};
