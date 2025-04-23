import { BaseException } from './BaseException';

export class AuthException extends BaseException {
  constructor(message: string, statusCode: number = 500, details?: Record<string, any>, errorCode: string = 'AUTHENTICATION_ERROR') {
    super(message, statusCode, details, errorCode);
  }
}