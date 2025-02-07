export enum VendorEventTypes {
    CREATE_ORDER = 'create_order',
    GET_LABEL = 'get_label'
}

// Control which events are enabled/disabled
export const VENDOR_EVENT_STATUS: Record<VendorEventTypes, boolean> = {
    [VendorEventTypes.CREATE_ORDER]: true,
    [VendorEventTypes.GET_LABEL]: true,
};
