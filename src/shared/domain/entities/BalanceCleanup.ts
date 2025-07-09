export interface BalanceCleanupTimer {
    dbprefix: string;
    scheduledAt: Date;
    expiresAt: Date;
    isActive: boolean;
    lastResetAt?: Date;
}

export interface BalanceCleanupResult {
    dbprefix: string;
    success: boolean;
    keysRemoved: string[];
    error?: string;
    cleanupAt: Date;
}

export enum BalanceCleanupTimerField {
    SCHEDULED_AT = 'scheduled_at',
    EXPIRES_AT = 'expires_at',
    IS_ACTIVE = 'is_active',
    LAST_RESET_AT = 'last_reset_at'
}

export class BalanceCleanupError extends Error {
    constructor(message: string, public dbprefix?: string) {
        super(message);
        this.name = 'BalanceCleanupError';
    }
} 