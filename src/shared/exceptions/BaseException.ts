export class BaseException extends Error {
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly errorCode?: string;

  constructor(message: string, statusCode: number = 500, details?: Record<string, any>, errorCode?: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      details: this.details,
    };
  }
}