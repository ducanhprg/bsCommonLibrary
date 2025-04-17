import { Request, Response, NextFunction } from 'express';
import BaseLogger from './BaseLogger';
import { requestLogger } from './RequestLogger';
import { errorLogger } from './ErrorLogger';
import { errorHandler } from './ErrorHandler';
import { Application } from 'express';

export class Logger {
  static logger = BaseLogger;

  static info(message: string, meta?: any): void {
    this.logger.info(message, { ...meta });
  }

  static error(message: string, meta?: any): void {
    this.logger.error(message, { ...meta });
  }

  static warn(message: string, meta?: any): void {
    this.logger.warn(message, { ...meta });
  }

  static debug(message: string, meta?: any): void {
    this.logger.debug(message, { ...meta });
  }

  static http(message: string, meta?: any): void {
    this.logger.http(message, { ...meta });
  }

  static registerWithApp(app: Application): void {
    app.use((req: Request, res: Response, next: NextFunction) => {
      req.requestId = Date.now().toString();
      next();
    });
    app.use(requestLogger);
    app.use(errorLogger);
    app.use(errorHandler as (err: Error, req: Request, res: Response, next: NextFunction) => void);
  }

  static getRequestLogger() {
    return requestLogger;
  }

  static getErrorLogger() {
    return errorLogger;
  }

  static getErrorHandler() {
    return errorHandler;
  }
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}