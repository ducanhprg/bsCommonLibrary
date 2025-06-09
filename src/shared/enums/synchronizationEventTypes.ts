export enum SynchronizationEventTypes {
    CREATE_PARCEL = 'create_parcel',
    CANCEL_PARCEL = 'cancel_parcel',
}

// Control which events are enabled/disabled
export const SYNCHRONIZATION_EVENT_STATUS: Record<SynchronizationEventTypes, boolean> = {
    [SynchronizationEventTypes.CREATE_PARCEL]: true,
    [SynchronizationEventTypes.CANCEL_PARCEL]: true,
};
