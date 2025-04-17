import { Request, Response, NextFunction } from 'express';
import { BaseException } from '@shared/exceptions/BaseException';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.requestId || 'unknown';

  if (err instanceof BaseException) {
    return res.status(err.statusCode).json({
      success: false,
      requestId,
      ...err.toJSON(),
    });
  }

  return res.status(500).json({
    success: false,
    requestId,
    message: 'Internal Server Error',
    errorCode: 'INTERNAL_ERROR',
  });
};