/**
 * logger.ts — Structured JSON logger.
 *
 * Every log line is a single JSON object that includes:
 *   timestamp   — ISO 8601 wall-clock time
 *   level       — info | warn | error | debug
 *   instance_id — which container produced the log
 *   message     — human-readable description
 *   ...context  — arbitrary key/value pairs (request_id, clinic_id, etc.)
 *
 * Using JSON lines means the output can be ingested by any log aggregator
 * (ELK, Datadog, Loki) without a parser. Under k6 load tests, the structured
 * format makes it easy to grep for a specific clinic_id or request_id.
 *
 * No external dependencies — implemented with process.stdout/stderr writes.
 */

import { config } from './config';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/** Arbitrary structured context attached to a log line. */
export interface LogContext {
  request_id?: string;
  clinic_id?:  number;
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, ctx: LogContext = {}): void {
  const line = JSON.stringify({
    timestamp:   new Date().toISOString(),
    level,
    instance_id: config.instanceId,
    message,
    ...ctx,
  });

  // errors and warnings go to stderr; info/debug go to stdout.
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  info:  (message: string, ctx?: LogContext) => write('info',  message, ctx),
  warn:  (message: string, ctx?: LogContext) => write('warn',  message, ctx),
  error: (message: string, ctx?: LogContext) => write('error', message, ctx),
  debug: (message: string, ctx?: LogContext) => write('debug', message, ctx),
};
