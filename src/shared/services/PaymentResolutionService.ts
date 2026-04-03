import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from '@shared/configs/redisConfig';
import { BalanceOperationType } from '@shared/domain/entities/Balance';
import { BalanceFactory } from '@shared/utils/BalanceFactory';
import { getDataByHashKey, updateOrCreateHashFields } from '@shared/utils/RedisClient';
import { BalanceService } from './BalanceService';

export type PaymentResolutionStatus = 'pending' | 'completed' | 'reversed';
export type PaymentResolutionOutcome = 'complete' | 'reverse';

interface ResolutionMetadata extends Record<string, any> {
    requestId?: string;
    requestItemId: string;
    source_service: string;
    reason: string;
}

export interface MarkPendingHoldInput {
    requestItemId: string;
    amount: number;
    sourceService: string;
    reason?: string;
}

export interface ResolveHeldPaymentInput {
    requestId?: string;
    requestItemId: string;
    dbprefix: string;
    database: string;
    amount: number;
    outcome: PaymentResolutionOutcome;
    sourceService: string;
    reason: string;
    metadata?: Record<string, any>;
}

export interface ResolveHeldPaymentResult {
    applied: boolean;
    finalStatus: PaymentResolutionStatus;
}

export class PaymentResolutionService {
    private readonly redis = getRedisClient();
    private readonly repository = BalanceFactory.getBalanceRepository();

    async markPendingHold(input: MarkPendingHoldInput): Promise<void> {
        await updateOrCreateHashFields(this.getResponseKey(input.requestItemId), {
            payment_resolution_status: 'pending',
            payment_resolution_reason: input.reason || 'hold_created',
            payment_resolution_amount: String(input.amount),
            payment_resolution_at: new Date().toISOString(),
            payment_resolution_source: input.sourceService,
        });
    }

    async resolveHeldPayment(input: ResolveHeldPaymentInput): Promise<ResolveHeldPaymentResult> {
        const desiredStatus: PaymentResolutionStatus =
            input.outcome === 'complete' ? 'completed' : 'reversed';
        const operationType =
            input.outcome === 'complete'
                ? BalanceOperationType.COMPLETE_PAYMENT
                : BalanceOperationType.REVERSE_PAYMENT;

        const existingStatus = await this.getExistingStatus(input.requestItemId);
        if (existingStatus === desiredStatus) {
            return { applied: false, finalStatus: desiredStatus };
        }
        if (existingStatus === 'completed' || existingStatus === 'reversed') {
            return { applied: false, finalStatus: existingStatus };
        }

        const auditMatched = await this.findAuditResolution(input.dbprefix, input.requestItemId, operationType);
        if (auditMatched) {
            await this.persistResolution(input, desiredStatus, false);
            return { applied: false, finalStatus: desiredStatus };
        }

        const lockKey = this.getLockKey(input.requestItemId);
        const lockId = uuidv4();
        const acquired = await this.acquireLock(lockKey, lockId);
        if (!acquired) {
            throw new Error(`Could not acquire payment resolution lock for ${input.requestItemId}`);
        }

        try {
            const lockedStatus = await this.getExistingStatus(input.requestItemId);
            if (lockedStatus === desiredStatus) {
                return { applied: false, finalStatus: desiredStatus };
            }
            if (lockedStatus === 'completed' || lockedStatus === 'reversed') {
                return { applied: false, finalStatus: lockedStatus };
            }

            const lockedAuditMatched = await this.findAuditResolution(input.dbprefix, input.requestItemId, operationType);
            if (lockedAuditMatched) {
                await this.persistResolution(input, desiredStatus, false);
                return { applied: false, finalStatus: desiredStatus };
            }

            const balanceService = new BalanceService(
                this.repository,
                {},
                input.dbprefix,
                input.database
            );

            const metadata = this.buildMetadata(input);
            const success =
                input.outcome === 'complete'
                    ? await balanceService.completePayment(input.dbprefix, input.amount, metadata)
                    : await balanceService.reversePayment(input.dbprefix, input.amount, metadata);

            if (!success) {
                throw new Error(
                    `${operationType} returned false for request item ${input.requestItemId}`
                );
            }

            await this.persistResolution(input, desiredStatus, true);
            return { applied: true, finalStatus: desiredStatus };
        } finally {
            await this.releaseLock(lockKey, lockId);
        }
    }

    private buildMetadata(input: ResolveHeldPaymentInput): ResolutionMetadata {
        return {
            ...input.metadata,
            requestId: input.requestId,
            requestItemId: input.requestItemId,
            source_service: input.sourceService,
            reason: input.reason,
        };
    }

    private async persistResolution(
        input: ResolveHeldPaymentInput,
        status: PaymentResolutionStatus,
        applied: boolean
    ): Promise<void> {
        await updateOrCreateHashFields(this.getResponseKey(input.requestItemId), {
            payment_resolution_status: status,
            payment_resolution_reason: input.reason,
            payment_resolution_amount: String(input.amount),
            payment_resolution_at: new Date().toISOString(),
            payment_resolution_source: input.sourceService,
            payment_resolution_applied: applied ? 'true' : 'false',
        });
    }

    private async getExistingStatus(
        requestItemId: string
    ): Promise<PaymentResolutionStatus | null> {
        const data = await getDataByHashKey(this.getResponseKey(requestItemId));
        const status = data?.payment_resolution_status;

        if (status === 'pending' || status === 'completed' || status === 'reversed') {
            return status;
        }

        return null;
    }

    private async findAuditResolution(
        dbprefix: string,
        requestItemId: string,
        operationType: BalanceOperationType
    ): Promise<boolean> {
        const history = await this.repository.getOperationHistory(dbprefix, 500);
        return history.some(
            (entry) =>
                entry.operationType === operationType &&
                entry.metadata?.requestItemId === requestItemId
        );
    }

    private getResponseKey(requestItemId: string): string {
        return `print_label_response:${requestItemId}`;
    }

    private getLockKey(requestItemId: string): string {
        return `payment_resolution_lock:${requestItemId}`;
    }

    private async acquireLock(lockKey: string, lockId: string): Promise<boolean> {
        const result = await this.redis.set(lockKey, lockId, 'EX', 30, 'NX');
        return result === 'OK';
    }

    private async releaseLock(lockKey: string, lockId: string): Promise<void> {
        const script = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            end
            return 0
        `;

        await this.redis.eval(script, 1, lockKey, lockId);
    }
}
