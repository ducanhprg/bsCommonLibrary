import { ExceptionHandler, ExceptionType } from './ExceptionHandler';
import { RocketChatNotifier } from '@shared/integrations/RocketChatNotifier';

export type Result<T, E = Error> = {
    success: true;
    data: T;
} | {
    success: false;
    error: E;
    message: string;
    context?: Record<string, any>;
};

export interface LogMessage {
    message: string;
    context?: Record<string, any>;
    sendAlert?: boolean;
}

export enum ErrorType {
    VALIDATION = 'validation',
    NOT_FOUND = 'not_found',
    AUTHENTICATION = 'authentication',
    AUTHORIZATION = 'authorization',
    BUSINESS_RULE = 'business_rule',
    VENDOR_SERVICE = 'vendor_service',
    SYSTEM = 'system',
    RATE_LIMIT = 'rate_limit',
    DATABASE_CONNECTION = 'database_connection',
    DATABASE_NOT_EXISTS = 'database_not_exists',
    TABLE_NOT_EXISTS = 'table_not_exists',
    INSUFFICIENT_FUNDS = 'insufficient_funds',
    INVALID_OPERATION = 'invalid_operation'
}

export interface ErrorDetails {
    type: ErrorType;
    code: string;
    message: string;
    context?: Record<string, any>;
    cause?: Error;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
    sendAlert?: boolean;
}

export class ErrorFactory {
    static validation(message: string, context?: Record<string, any>, sendAlert?: boolean): ErrorDetails {
        return {
            type: ErrorType.VALIDATION,
            code: 'VALIDATION_ERROR',
            message,
            context,
            timestamp: new Date(),
            severity: 'medium',
            sendAlert
        };
    }

    static notFound(resource: string, context?: Record<string, any>, sendAlert?: boolean): ErrorDetails {
        return {
            type: ErrorType.NOT_FOUND,
            code: 'RESOURCE_NOT_FOUND',
            message: `${resource} not found`,
            context,
            timestamp: new Date(),
            severity: 'medium',
            sendAlert
        };
    }

    static businessRule(message: string, context?: Record<string, any>, sendAlert?: boolean): ErrorDetails {
        return {
            type: ErrorType.BUSINESS_RULE,
            code: 'BUSINESS_RULE_VIOLATION',
            message,
            context,
            timestamp: new Date(),
            severity: 'high',
            sendAlert
        };
    }

    static system(message: string, cause?: Error, context?: Record<string, any>, sendAlert?: boolean): ErrorDetails {
        return {
            type: ErrorType.SYSTEM,
            code: 'SYSTEM_ERROR',
            message,
            cause,
            context,
            timestamp: new Date(),
            severity: 'critical',
            sendAlert
        };
    }

    static vendorService(service: string, message: string, context?: Record<string, any>, sendAlert?: boolean): ErrorDetails {
        return {
            type: ErrorType.VENDOR_SERVICE,
            code: 'EXTERNAL_SERVICE_ERROR',
            message: `${service}: ${message}`,
            context,
            timestamp: new Date(),
            severity: 'high',
            sendAlert
        };
    }

    static databaseConnection(message: string, context?: Record<string, any>, sendAlert?: boolean): ErrorDetails {
        return {
            type: ErrorType.DATABASE_CONNECTION,
            code: 'DATABASE_CONNECTION_ERROR',
            message,
            context,
            timestamp: new Date(),
            severity: 'critical',
            sendAlert
        };
    }

    static databaseNotExists(database: string, context?: Record<string, any>, sendAlert?: boolean): ErrorDetails {
        return {
            type: ErrorType.DATABASE_NOT_EXISTS,
            code: 'DATABASE_NOT_EXISTS',
            message: `Database '${database}' does not exist`,
            context,
            timestamp: new Date(),
            severity: 'high',
            sendAlert
        };
    }

    static tableNotExists(table: string, context?: Record<string, any>, sendAlert?: boolean): ErrorDetails {
        return {
            type: ErrorType.TABLE_NOT_EXISTS,
            code: 'TABLE_NOT_EXISTS',
            message: `Table '${table}' does not exist`,
            context,
            timestamp: new Date(),
            severity: 'high',
            sendAlert
        };
    }

    static insufficientFunds(message: string, context?: Record<string, any>, sendAlert?: boolean): ErrorDetails {
        return {
            type: ErrorType.INSUFFICIENT_FUNDS,
            code: 'INSUFFICIENT_FUNDS',
            message,
            context,
            timestamp: new Date(),
            severity: 'medium',
            sendAlert
        };
    }

    static invalidOperation(message: string, context?: Record<string, any>, sendAlert?: boolean): ErrorDetails {
        return {
            type: ErrorType.INVALID_OPERATION,
            code: 'INVALID_OPERATION',
            message,
            context,
            timestamp: new Date(),
            severity: 'medium',
            sendAlert
        };
    }
}

export class ErrorManager {
    private static instance: ErrorManager;
    private loggers: Array<(error: ErrorDetails) => void> = [];

    private constructor() {}

    static getInstance(): ErrorManager {
        if (!ErrorManager.instance) {
            ErrorManager.instance = new ErrorManager();
        }
        return ErrorManager.instance;
    }

    addLogger(logger: (error: ErrorDetails) => void): void {
        this.loggers.push(logger);
    }

    logError(error: ErrorDetails): void {
        this.loggers.forEach(logger => {
            try {
                logger(error);
            } catch (logError) {
                console.error('Logger failed:', logError);
            }
        });

        // Send to RocketChat if critical or sendAlert flag is true
        if (error.severity === 'critical' || error.sendAlert === true) {
            RocketChatNotifier.sendAlert('error', error.message, error.context, error);
        }
    }

    logInfo(message: string | LogMessage, context?: Record<string, any>): void {
        if (typeof message === 'string') {
            console.info(message, context);
        } else {
            console.info(message.message, message.context);

            // Send to RocketChat if sendAlert flag is true
            if (message.sendAlert === true) {
                RocketChatNotifier.sendAlert('info', message.message, message.context);
            }
        }
    }

    logDebug(message: string | LogMessage, context?: Record<string, any>): void {
        if (typeof message === 'string') {
            console.debug(message, context);
        } else {
            console.debug(message.message, message.context);

            // Send to RocketChat if sendAlert flag is true
            if (message.sendAlert === true) {
                RocketChatNotifier.sendAlert('debug', message.message, message.context);
            }
        }
    }

    logWarn(message: string | LogMessage, context?: Record<string, any>): void {
        if (typeof message === 'string') {
            console.warn(message, context);
        } else {
            console.warn(message.message, message.context);

            // Send to RocketChat if sendAlert flag is true
            if (message.sendAlert === true) {
                RocketChatNotifier.sendAlert('warn', message.message, message.context);
            }
        }
    }

    createFailureResult<T>(error: ErrorDetails): Result<T, ErrorDetails> {
        this.logError(error);
        return {
            success: false,
            error,
            message: error.message,
            context: error.context
        };
    }

    createSuccessResult<T>(data: T): Result<T, ErrorDetails> {
        return {
            success: true,
            data
        };
    }

    throwException(error: ErrorDetails): never {
        this.logError(error);
        
        const typeMapping: Record<ErrorType, ExceptionType> = {
            [ErrorType.VALIDATION]: ExceptionType.VALIDATION,
            [ErrorType.NOT_FOUND]: ExceptionType.NOT_FOUND,
            [ErrorType.AUTHENTICATION]: ExceptionType.AUTHENTICATION,
            [ErrorType.AUTHORIZATION]: ExceptionType.AUTHENTICATION,
            [ErrorType.VENDOR_SERVICE]: ExceptionType.VENDOR,
            [ErrorType.BUSINESS_RULE]: ExceptionType.API,
            [ErrorType.SYSTEM]: ExceptionType.API,
            [ErrorType.RATE_LIMIT]: ExceptionType.API,
            [ErrorType.DATABASE_CONNECTION]: ExceptionType.API,
            [ErrorType.DATABASE_NOT_EXISTS]: ExceptionType.NOT_FOUND,
            [ErrorType.TABLE_NOT_EXISTS]: ExceptionType.NOT_FOUND,
            [ErrorType.INSUFFICIENT_FUNDS]: ExceptionType.API,
            [ErrorType.INVALID_OPERATION]: ExceptionType.VALIDATION
        };

        const exceptionType = typeMapping[error.type] || ExceptionType.API;
        const statusCode = this.getStatusCodeForErrorType(error.type);
        
        ExceptionHandler.throw(exceptionType, error.message, statusCode, error.context, error.code);
    }

    private getStatusCodeForErrorType(errorType: ErrorType): number {
        const statusCodeMap: Record<ErrorType, number> = {
            [ErrorType.VALIDATION]: 400,
            [ErrorType.NOT_FOUND]: 404,
            [ErrorType.AUTHENTICATION]: 401,
            [ErrorType.AUTHORIZATION]: 403,
            [ErrorType.VENDOR_SERVICE]: 502,
            [ErrorType.BUSINESS_RULE]: 422,
            [ErrorType.SYSTEM]: 500,
            [ErrorType.RATE_LIMIT]: 429,
            [ErrorType.DATABASE_CONNECTION]: 503,
            [ErrorType.DATABASE_NOT_EXISTS]: 404,
            [ErrorType.TABLE_NOT_EXISTS]: 404,
            [ErrorType.INSUFFICIENT_FUNDS]: 422,
            [ErrorType.INVALID_OPERATION]: 400
        };
        
        return statusCodeMap[errorType] || 500;
    }
} 