import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => {
      const metadata = info.metadata as { requestId?: string };
      return `${info.timestamp} ${info.level}: ${info.message} ${metadata?.requestId ? `[RequestID: ${metadata.requestId}]` : ''}`;
    },
  ),
);

const transports = [
  new winston.transports.Console(),
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '14d', // Keep logs for 14 days
  }),
  new DailyRotateFile({
    filename: 'logs/all-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
  }),
];

const BaseLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format,
  transports,
});

export default BaseLogger;