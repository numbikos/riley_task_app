/**
 * Logger utility for consistent logging across the application.
 *
 * - Default log level: 'warn' in dev, 'error' in prod
 * - Override with VITE_LOG_LEVEL=debug|info|warn|error|silent
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

const VALID_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];

const normalizeLevel = (value?: string): LogLevel | null => {
  if (!value) return null;
  const lowered = value.toLowerCase();
  return VALID_LEVELS.includes(lowered as LogLevel) ? lowered as LogLevel : null;
};

const baseLevel: LogLevel = import.meta.env.DEV ? 'warn' : 'error';
const currentLevel: LogLevel = normalizeLevel(import.meta.env.VITE_LOG_LEVEL as string | undefined) || baseLevel;

const shouldLog = (level: LogLevel): boolean => LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];

const log = (level: LogLevel, fn: (...args: any[]) => void, args: any[]): void => {
  if (shouldLog(level)) {
    fn(...args);
  }
};

export const logger = {
  debug: (...args: any[]): void => log('debug', console.log, args),
  info: (...args: any[]): void => log('info', console.info, args),
  warn: (...args: any[]): void => log('warn', console.warn, args),
  error: (...args: any[]): void => log('error', console.error, args),
};
