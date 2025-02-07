export enum ValidatorEventTypes {
    VALIDATE = 'validate',
}

export const EVENT_STATUS: Record<ValidatorEventTypes, boolean> = {
    [ValidatorEventTypes.VALIDATE]: true,
};
