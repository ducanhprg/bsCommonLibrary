import { Request, Response, NextFunction } from 'express';
import { ExceptionHandler } from '@shared/exceptions/ExceptionHandler';
import { MessageCode } from '@shared/constants/messages';

export interface ValidationRule {
    field: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean;
    message?: string;
    source?: 'body' | 'query' | 'params'; // Add source specification
}

export function Validate(rules: ValidationRule[], defaultSource: 'body' | 'query' | 'params' = 'body') {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
            try {
                const errors: Record<string, string[]> = {};

                for (const rule of rules) {
                    const source = rule.source || defaultSource;
                    let value: any;
                    
                    // Get value from appropriate source
                    switch (source) {
                        case 'query':
                            value = req.query[rule.field];
                            break;
                        case 'params':
                            value = req.params[rule.field];
                            break;
                        case 'body':
                        default:
                            value = req.body[rule.field];
                            break;
                    }
                    
                    // Convert types for query/params (they come as strings)
                    if ((source === 'query' || source === 'params') && value !== undefined && value !== null && value !== '') {
                        if (rule.type === 'number') {
                            const numValue = Number(value);
                            value = isNaN(numValue) ? value : numValue;
                        } else if (rule.type === 'boolean') {
                            value = value === 'true' || value === '1';
                        }
                    }
                    
                    const fieldErrors: string[] = [];

                    // Check required field
                    if (rule.required && (value === undefined || value === null || value === '')) {
                        fieldErrors.push(rule.message || `${rule.field} is required`);
                        continue;
                    }

                    // Skip further validation if field is not required and value is empty
                    if (!rule.required && (value === undefined || value === null || value === '')) {
                        continue;
                    }

                    // Type validation
                    if (rule.type) {
                        switch (rule.type) {
                            case 'string':
                                if (typeof value !== 'string') {
                                    fieldErrors.push(`${rule.field} must be a string`);
                                }
                                break;
                            case 'number':
                                if (typeof value !== 'number' || isNaN(value)) {
                                    fieldErrors.push(`${rule.field} must be a number`);
                                }
                                break;
                            case 'boolean':
                                if (typeof value !== 'boolean') {
                                    fieldErrors.push(`${rule.field} must be a boolean`);
                                }
                                break;
                            case 'array':
                                if (!Array.isArray(value)) {
                                    fieldErrors.push(`${rule.field} must be an array`);
                                }
                                break;
                            case 'object':
                                if (typeof value !== 'object' || Array.isArray(value)) {
                                    fieldErrors.push(`${rule.field} must be an object`);
                                }
                                break;
                        }
                    }

                    // Length validation for strings and arrays
                    if (rule.type === 'string' || rule.type === 'array') {
                        if (rule.minLength !== undefined && value.length < rule.minLength) {
                            fieldErrors.push(`${rule.field} must be at least ${rule.minLength} characters`);
                        }
                        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
                            fieldErrors.push(`${rule.field} must not exceed ${rule.maxLength} characters`);
                        }
                    }

                    // Range validation for numbers
                    if (rule.type === 'number') {
                        if (rule.min !== undefined && value < rule.min) {
                            fieldErrors.push(`${rule.field} must be at least ${rule.min}`);
                        }
                        if (rule.max !== undefined && value > rule.max) {
                            fieldErrors.push(`${rule.field} must not exceed ${rule.max}`);
                        }
                    }

                    // Pattern validation for strings
                    if (rule.type === 'string' && rule.pattern && !rule.pattern.test(value)) {
                        fieldErrors.push(`${rule.field} does not match the required pattern`);
                    }

                    // Custom validation
                    if (rule.custom && !rule.custom(value)) {
                        fieldErrors.push(rule.message || `${rule.field} is invalid`);
                    }

                    if (fieldErrors.length > 0) {
                        errors[rule.field] = fieldErrors;
                    }
                }

                if (Object.keys(errors).length > 0) {
                    // Create proper ValidationException instead of ErrorDetails
                    const validationException = ExceptionHandler.createValidation(
                        MessageCode.VALIDATION_REQUIRED_FIELDS,
                        { errors },
                        'VALIDATION_ERROR'
                    );
                    
                    return next(validationException);
                }

                return originalMethod.apply(this, [req, res, next]);
            } catch (error) {
                next(error);
            }
        };

        return descriptor;
    };
} 