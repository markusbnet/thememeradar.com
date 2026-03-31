const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  info: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args); // eslint-disable-line no-console
    }
  },
  error: (...args: unknown[]) => {
    console.error(...args); // eslint-disable-line no-console
  },
  warn: (...args: unknown[]) => {
    console.warn(...args); // eslint-disable-line no-console
  },
};
