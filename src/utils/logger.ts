/**
 * Logger utility for consistent logging across the application.
 * 
 * - debug/info: Only logged in development mode
 * - warn/error: Always logged (even in production)
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Debug logs - only shown in development
   */
  debug: (...args: any[]): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Info logs - only shown in development
   */
  info: (...args: any[]): void => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Warning logs - always shown (even in production)
   */
  warn: (...args: any[]): void => {
    console.warn(...args);
  },

  /**
   * Error logs - always shown (even in production)
   */
  error: (...args: any[]): void => {
    console.error(...args);
  },
};

