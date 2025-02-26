export enum Services {
    SERVICE_VALIDATOR = 'validator',
    CONSOLIDATOR_SERVICE = 'consolidator'
}

export const SERVICE_STATUS: Record<Services, boolean> = {
    [Services.SERVICE_VALIDATOR]: true,
    [Services.CONSOLIDATOR_SERVICE]: true,
};
