import { BaseException } from './BaseException';
import { ApiException } from './ApiException';
import { NotFoundException } from './NotFoundException';
import { ValidationException } from './ValidationException';
import { VendorException } from './VendorException';

enum ExceptionType {
  BASE = 'base',
  API = 'api',
  VALIDATION = 'validation',
  NOT_FOUND = 'notFound',
  VENDOR = 'vendor',
}

export class ExceptionHandler {
  private static exceptionMap: Record<ExceptionType, new (...args: any[]) => BaseException> = {
    [ExceptionType.BASE]: BaseException,
    [ExceptionType.API]: ApiException,
    [ExceptionType.VALIDATION]: ValidationException,
    [ExceptionType.NOT_FOUND]: NotFoundException,
    [ExceptionType.VENDOR]: VendorException,
  };

  static createBase(message: string, statusCode: number = 500, details?: Record<string, any>, errorCode?: string): BaseException {
    return new BaseException(message, statusCode, details, errorCode);
  }

  static createApi(message: string, statusCode: number = 500, details?: Record<string, any>, errorCode?: string): ApiException {
    return new ApiException(message, statusCode, details, errorCode);
  }

  static createValidation(message: string, details?: Record<string, any>, errorCode?: string): ValidationException {
    return new ValidationException(message, details, errorCode);
  }

  static createNotFound(message: string, details?: Record<string, any>, errorCode?: string): NotFoundException {
    return new NotFoundException(message, details, errorCode);
  }

  static createVendor(message: string, statusCode: number = 500, details?: Record<string, any>, errorCode?: string): VendorException {
    return new VendorException(message, statusCode, details, errorCode);
  }

  static throw(type: ExceptionType, message: string, statusCode?: number, details?: Record<string, any>, errorCode?: string): never {
    const ExceptionClass = this.exceptionMap[type];
    if (!ExceptionClass) {
      throw new Error(`Unknown exception type: ${type}`);
    }
    const args = type === ExceptionType.VALIDATION || type === ExceptionType.NOT_FOUND
      ? [message, details, errorCode]
      : [message, statusCode, details, errorCode];
    throw new ExceptionClass(...args);
  }
}

export { ExceptionType };