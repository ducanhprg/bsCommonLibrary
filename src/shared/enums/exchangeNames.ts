export enum ExchangeNames {
    VENDOR_REQUESTS = 'vendor_requests',
    VALIDATOR_REQUESTS = 'validator_requests',
    CONSOLIDATOR_REQUEST = 'consolidator_request',
    CONSOLIDATOR_RESPONSE = 'consolidator_response',
}

export const EXCHANGE_NAME_STATUSES: Record<ExchangeNames, boolean> = {
    [ExchangeNames.VENDOR_REQUESTS]: true,
    [ExchangeNames.VALIDATOR_REQUESTS]: true,
    [ExchangeNames.CONSOLIDATOR_REQUEST]: true,
    [ExchangeNames.CONSOLIDATOR_RESPONSE]: true,
};
