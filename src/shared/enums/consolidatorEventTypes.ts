export enum consolidatorEventTypes {
    GET_LABEL = 'get_label',
    CANCEL_LABEL = 'cancel_label'
}

// Control which events are enabled/disabled
export const CONSOLIDATOR_EVENT_STATUS: Record<consolidatorEventTypes, boolean> = {
    [consolidatorEventTypes.GET_LABEL]: true,
    [consolidatorEventTypes.CANCEL_LABEL]: true,
};
