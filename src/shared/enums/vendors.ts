export enum Vendors {
    VENDOR_GDE = 'vendor_gde',
    VENDOR_UPS = 'vendor_ups',
    VENDOR_DHL = 'vendor_dhl',
    VENDOR_FEDEX = 'vendor_fedex',
    VENDOR_SHIPSAVING = 'vendor_shipsaving',
    VENDOR_DP = 'vendor_dp',
    SERVICE_VALIDATOR = 'validator',
}

export const VENDOR_STATUS: Record<Vendors, boolean> = {
    [Vendors.VENDOR_GDE]: true,
    [Vendors.VENDOR_UPS]: false,
    [Vendors.VENDOR_DHL]: false,
    [Vendors.VENDOR_FEDEX]: false,
    [Vendors.VENDOR_SHIPSAVING]: false,
    [Vendors.VENDOR_DP]: false,
    [Vendors.SERVICE_VALIDATOR]: true,
};
