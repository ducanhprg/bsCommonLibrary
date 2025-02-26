export enum consolidatorEventTypes {
    CREATE_ORDER = 'create_order',
    CANCEL_LABEL = 'cancel_label'
}

// Control which events are enabled/disabled
export const CONSOLIDATOR_EVENT_STATUS: Record<consolidatorEventTypes, boolean> = {
    [consolidatorEventTypes.CREATE_ORDER]: true,
    [consolidatorEventTypes.CANCEL_LABEL]: true,
};
