import { ExceptionHandler, ExceptionType } from '../exceptions/ExceptionHandler';
import { MessageCode } from '../constants/messages';

export class InputSanitizer {
    /**
     * Sanitizes a string input by trimming whitespace and preventing SQL injection
     * @param input The input string to sanitize
     * @param fieldName The name of the field being sanitized (for error messages)
     * @returns The sanitized string
     */
    static sanitizeString(input: string | undefined | null, fieldName: string): string {
        if (input === undefined || input === null) {
            return '';
        }

        // Trim whitespace
        const trimmed = input.trim();

        // Basic SQL injection prevention
        const sanitized = trimmed.replace(/['";]/g, '');

        return sanitized;
    }

    /**
     * Validates and sanitizes a date string
     * @param dateStr The date string to validate
     * @param fieldName The name of the field being validated (for error messages)
     * @returns The validated Date object
     */
    static validateDate(dateStr: string | undefined | null, fieldName: string): Date | null {
        if (!dateStr) {
            return null;
        }

        const sanitized = this.sanitizeString(dateStr, fieldName);
        const date = new Date(sanitized);

        if (isNaN(date.getTime())) {
            ExceptionHandler.throw(
                ExceptionType.VALIDATION,
                MessageCode.SYSTEM_BAD_REQUEST,
                undefined,
                { field: fieldName },
                'INVALID_DATE_FORMAT'
            );
        }

        return date;
    }

    /**
     * Validates a date range
     * @param startDate The start date
     * @param endDate The end date
     * @param startFieldName The name of the start date field
     * @param endFieldName The name of the end date field
     */
    static validateDateRange(
        startDate: Date | null,
        endDate: Date | null,
        startFieldName: string,
        endFieldName: string
    ): void {
        if (startDate && endDate && startDate > endDate) {
            ExceptionHandler.throw(
                ExceptionType.VALIDATION,
                MessageCode.SYSTEM_BAD_REQUEST,
                undefined,
                { startDate, endDate },
                'INVALID_DATE_RANGE'
            );
        }
    }

    /**
     * Validates and sanitizes a numeric input
     * @param input The input to validate
     * @param fieldName The name of the field being validated
     * @returns The validated number
     */
    static validateNumber(input: string | number | undefined | null, fieldName: string): number | null {
        if (input === undefined || input === null) {
            return null;
        }

        if (typeof input === 'number') {
            return input;
        }

        const sanitized = this.sanitizeString(input, fieldName);
        const number = parseInt(sanitized, 10);

        if (isNaN(number)) {
            ExceptionHandler.throw(
                ExceptionType.VALIDATION,
                MessageCode.SYSTEM_BAD_REQUEST,
                undefined,
                { field: fieldName },
                'INVALID_NUMBER_FORMAT'
            );
        }

        return number;
    }

    /**
     * Sanitizes an object of string inputs
     * @param input The input object to sanitize
     * @returns A new object with sanitized values
     */
    static sanitizeObject<T extends Record<string, string | undefined | null>>(input: T): T {
        const result = { ...input };

        for (const key in result) {
            if (typeof result[key] === 'string') {
                result[key] = this.sanitizeString(result[key] as string, key) as T[typeof key];
            }
        }

        return result;
    }

    /**
     * Sanitizes a comma-separated string into an array of sanitized values
     * @param input The comma-separated string to sanitize
     * @param fieldName The name of the field being sanitized (for error messages)
     * @returns Array of sanitized values, with empty values filtered out
     */
    static sanitizeCommaSeparated(input: string | undefined | null, fieldName: string): string[] {
        if (!input) {
            return [];
        }

        const sanitized = this.sanitizeString(input, fieldName);
        return sanitized
            .split(',')
            .map(item => item.trim())
            .filter(item => item.length > 0);
    }
} 