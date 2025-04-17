import { BaseException } from './BaseException';

export class VendorException extends BaseException {
  constructor(message: string, statusCode: number = 500, details?: Record<string, any>, errorCode: string = 'API_ERROR') {
    if (statusCode < 400 || statusCode > 599) {
      throw new Error(`Invalid status code for ApiException: ${statusCode}`);
    }
    super(message, statusCode, details, errorCode);
  }
}