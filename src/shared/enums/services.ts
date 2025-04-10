export enum Services {
    VALIDATOR_SERVICE = 'validator',
    CONSOLIDATOR_SERVICE = 'consolidator',
    MONOLITH_SERVICE = 'monolith'
}

export const SERVICE_STATUS: Record<Services, boolean> = {
    [Services.VALIDATOR_SERVICE]: true,
    [Services.CONSOLIDATOR_SERVICE]: true,
    [Services.MONOLITH_SERVICE]: true,
};
