export enum MonolithEventTypes {
    DEFAULT = 'default',
}

// Control which events are enabled/disabled
export const MONOLITH_EVENT_STATUS: Record<MonolithEventTypes, boolean> = {
    [MonolithEventTypes.DEFAULT]: true,
};
