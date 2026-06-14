/**
 * config.ts — Centralized environment variable management.
 *
 * All environment variables are read and validated here, once, at process
 * startup. Any missing required variable causes an immediate exit with a
 * clear error message, so the problem is surfaced immediately rather than
 * causing a cryptic failure deep inside application code.
 *
 * No other file should read process.env directly.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    process.stderr.write(
      `[config] FATAL: Required environment variable "${key}" is not set. Exiting.\n`,
    );
    process.exit(1);
  }
  return value;
}

export const config = Object.freeze({
  /**
   * Identifies which container / process is running.
   * Set to "backend-1", "backend-2", or "worker" via Docker Compose.
   * Stored on every reservation row to prove load balancing works.
   */
  instanceId: process.env.INSTANCE_ID ?? 'unknown',

  /** TCP port the Express server listens on (default 8000). */
  port: parseInt(process.env.PORT ?? '8000', 10),

  /** PostgreSQL connection string, e.g. postgresql://user:pass@host:5432/db */
  databaseUrl: requireEnv('DATABASE_URL'),

  /** Redis connection URL, e.g. redis://host:6379 */
  redisUrl: requireEnv('REDIS_URL'),

  /** Node runtime environment — affects log verbosity in future extensions. */
  nodeEnv: process.env.NODE_ENV ?? 'development',
});
