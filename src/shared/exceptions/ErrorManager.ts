import { ExceptionHandler, ExceptionType } from './ExceptionHandler';

export type Result<T, E = Error> = {
    success: true;
    data: T;
} | {
    success: false;
    error: E;
    message: string;
    context?: Record<string, any>;
};

export enum ErrorType {
    VALIDATION = 'validation',
    NOT_FOUND = 'not_found',
    AUTHENTICATION = 'authentication',
    AUTHORIZATION = 'authorization',
    BUSINESS_RULE = 'business_rule',
    VENDOR_SERVICE = 'vendor_service',
    SYSTEM = 'system',
    RATE_LIMIT = 'rate_limit'
}

export interface ErrorDetails {
    type: ErrorType;
    code: string;
    message: string;
    context?: Record<string, any>;
    cause?: Error;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export class ErrorFactory {
    static validation(message: string, context?: Record<string, any>): ErrorDetails {
        return {
            type: ErrorType.VALIDATION,
            code: 'VALIDATION_ERROR',
            message,
            context,
            timestamp: new Date(),
            severity: 'medium'
        };
    }

    static notFound(resource: string, context?: Record<string, any>): ErrorDetails {
        return {
            type: ErrorType.NOT_FOUND,
            code: 'RESOURCE_NOT_FOUND',
            message: `${resource} not found`,
            context,
            timestamp: new Date(),
            severity: 'medium'
        };
    }

    static businessRule(message: string, context?: Record<string, any>): ErrorDetails {
        return {
            type: ErrorType.BUSINESS_RULE,
            code: 'BUSINESS_RULE_VIOLATION',
            message,
            context,
            timestamp: new Date(),
            severity: 'high'
        };
    }

    static system(message: string, cause?: Error, context?: Record<string, any>): ErrorDetails {
        return {
            type: ErrorType.SYSTEM,
            code: 'SYSTEM_ERROR',
            message,
            cause,
            context,
            timestamp: new Date(),
            severity: 'critical'
        };
    }

    static vendorService(service: string, message: string, context?: Record<string, any>): ErrorDetails {
        return {
            type: ErrorType.VENDOR_SERVICE,
            code: 'EXTERNAL_SERVICE_ERROR',
            message: `${service}: ${message}`,
            context,
            timestamp: new Date(),
            severity: 'high'
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
            [ErrorType.RATE_LIMIT]: ExceptionType.API
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
            [ErrorType.RATE_LIMIT]: 429
        };
        
        return statusCodeMap[errorType] || 500;
    }
} 