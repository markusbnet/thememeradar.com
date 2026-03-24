const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  info: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args); // eslint-disable-line no-console
    }
  },
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error(...args); // eslint-disable-line no-console
    }
  },
};
