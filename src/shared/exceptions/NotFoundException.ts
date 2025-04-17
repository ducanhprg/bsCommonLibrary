import { BaseException } from './BaseException';

export class NotFoundException extends BaseException {
  constructor(message: string, details?: Record<string, any>, errorCode: string = 'NOT_FOUND') {
    super(message, 404, details, errorCode);
  }
}