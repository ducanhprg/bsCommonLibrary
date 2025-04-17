import { Request, Response, NextFunction } from 'express';
import BaseLogger from './BaseLogger';
import { BaseException } from '../exceptions/BaseException';

export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.requestId || 'unknown';

  if (err instanceof BaseException) {
    BaseLogger.error(`${err.name}: ${err.message} - Status: ${err.statusCode} - ErrorCode: ${err.errorCode || 'N/A'}`, {
      requestId,
      url: `${req.method} ${req.url}`,
    });
    if (err.details) {
      BaseLogger.debug(`Error details: ${JSON.stringify(err.details)}`, { requestId });
    }
  } else {
    BaseLogger.error(`Unhandled error: ${err.message}`, { requestId, url: `${req.method} ${req.url}` });
    BaseLogger.debug(err.stack || 'No stack trace available', { requestId });
  }

  next(err);
};