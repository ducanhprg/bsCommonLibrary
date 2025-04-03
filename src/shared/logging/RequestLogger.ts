import { Request, Response, NextFunction } from 'express';
import BaseLogger from './BaseLogger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.requestId || 'unknown';

  BaseLogger.http(`Incoming request: ${req.method} ${req.url}`, {
    requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
  });

  if (req.body && Object.keys(req.body).length > 0) {
    const bodySize = JSON.stringify(req.body).length;
    if (bodySize < 10000) {
      BaseLogger.debug(`Request body: ${JSON.stringify(req.body)}`, { requestId });
    } else {
      BaseLogger.debug(`Request body too large to log (${bodySize} bytes)`, { requestId });
    }
  }

  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - start;
    BaseLogger.http(`Response sent: ${req.method} ${req.url} - Status: ${res.statusCode} - Duration: ${duration}ms`, { requestId });
    return originalSend.call(this, body);
  };

  next();
};