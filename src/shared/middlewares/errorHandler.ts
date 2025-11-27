import { Request, Response, NextFunction } from 'express';
import { BaseException } from '../exceptions/BaseException';
import { MessageManager } from '../service/MessageManager';
import { MessageCode } from '../constants/messages';

/**
 * Global error handling middleware for Express applications
 * Ensures all errors are returned as JSON responses instead of HTML
 */
export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction): void => {
    console.error('Global error handler:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        details: error.details,
        errorCode: error.errorCode,
        url: req.url,
        method: req.method
    });

    // Handle JSON parsing errors from express.json() middleware
    if (error instanceof SyntaxError && (error as any).status === 400 && 'body' in error) {
        res.status(400).json({
            status: false,
            message: 'Invalid JSON format in request body',
            error: {
                code: 'INVALID_JSON',
                details: {
                    message: error.message
                }
            }
        });
        return;
    }

    // Handle BaseException and its derivatives
    if (error instanceof BaseException) {
        res.status(error.statusCode).json({
            status: false,
            message: error.message,
            error: {
                code: error.errorCode || 'UNKNOWN_ERROR',
                details: error.details
            }
        });
        return;
    }

    // Handle other known error types that might not extend BaseException
    if (error.name === 'ValidationException' || error.errorCode === 'VALIDATION_ERROR') {
        res.status(400).json({
            status: false,
            message: error.message || MessageManager.getMessage(MessageCode.VALIDATION_REQUIRED_FIELDS),
            error: {
                code: error.errorCode || 'VALIDATION_ERROR',
                details: error.details || {}
            }
        });
        return;
    }

    // Handle unknown errors
    res.status(500).json({
        status: false,
        message: MessageManager.getMessage(MessageCode.SYSTEM_ERROR),
        error: {
            code: 'SYSTEM_ERROR'
        }
    });
};