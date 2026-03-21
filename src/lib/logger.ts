/**
 * Development-only logger. No-op in production to avoid leaking info and cluttering tools.
 */
const isDev = typeof process !== "undefined" && process.env.NODE_ENV === "development";

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
