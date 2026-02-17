/**
 * Logger Utility
 * Wraps console methods to suppress verbose logs in production.
 * Only console.log is suppressed in production — errors and warnings always show.
 * CLAUDE.md requirement: No console.log in production code.
 */

const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

export const logger = {
  /**
   * Debug/info logging — suppressed in production.
   */
  log: (...args: unknown[]): void => {
    if (isDev || isTest) {
      console.log(...args);
    }
  },

  /**
   * Warning logging — always shown.
   */
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },

  /**
   * Error logging — always shown.
   */
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
