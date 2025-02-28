export enum ConsolidatorEventTypes {
    GET_LABEL = 'get_label',
    CANCEL_LABEL = 'cancel_label'
}

// Control which events are enabled/disabled
export const CONSOLIDATOR_EVENT_STATUS: Record<ConsolidatorEventTypes, boolean> = {
    [ConsolidatorEventTypes.GET_LABEL]: true,
    [ConsolidatorEventTypes.CANCEL_LABEL]: false,
};
