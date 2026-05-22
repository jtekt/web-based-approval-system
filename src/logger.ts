import { createLogger, transports, format, LoggerOptions } from 'winston';
import LokiTransport from 'winston-loki';
import { env } from './env';

const { combine, timestamp, errors, json, colorize, printf } = format;

const consoleFormat = combine(
  colorize(),
  timestamp(),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

const loggerTransports: LoggerOptions['transports'] = [
  new transports.Console({
    format: consoleFormat,
  }),
];

if (env.LOKI_URL) {
  console.log(`[Logger] Loki enabled → ${env.LOKI_URL}`);

  loggerTransports.push(
    new LokiTransport({
      host: env.LOKI_URL,
      labels: { app: 'shinsei-manager' },
      json: true,
      format: combine(timestamp(), errors({ stack: true }), json()),
      replaceTimestamp: true,
      onConnectionError: (err: Error) => {
        console.error('Loki connection error:', err);
      },
    })
  );
}

export const logger = createLogger({
  transports: loggerTransports,
});
