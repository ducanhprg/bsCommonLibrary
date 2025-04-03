import { BaseException } from './BaseException';

export class ValidationException extends BaseException {
  constructor(message: string, details?: Record<string, any>, errorCode: string = 'VALIDATION_ERROR') {
    super(message, 400, details, errorCode);
  }
}