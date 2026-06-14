/**
 * errors.ts — Typed application error class and global error middleware.
 *
 * AppError is the single error type thrown by any layer of the application
 * when an unexpected condition occurs. It carries an HTTP status code and a
 * machine-readable code string, enabling the global handler to produce a
 * consistent error response shape without inspecting error messages.
 *
 * Business-logic failures that are expected (e.g. a time slot is already
 * taken) are NOT thrown as AppErrors — the service layer returns them as
 * Result<T> discriminated-union values so the caller can handle them
 * explicitly. See types.ts for the Result<T> pattern.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// ─── Error class ──────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    // Preserve the original stack trace in V8 engines.
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

/** Pre-built factories keep error creation sites concise and readable. */
export const Errors = {
  badRequest:         (msg: string) => new AppError(msg, 400, 'BAD_REQUEST'),
  notFound:           (msg: string) => new AppError(msg, 404, 'NOT_FOUND'),
  conflict:           (msg: string) => new AppError(msg, 409, 'CONFLICT'),
  serviceUnavailable: (msg: string) => new AppError(msg, 503, 'SERVICE_UNAVAILABLE'),
  internal:           (msg: string) => new AppError(msg, 500, 'INTERNAL_ERROR'),
} as const;

// ─── Global error middleware ──────────────────────────────────────────────────

/**
 * Express error-handling middleware must have exactly 4 parameters.
 * Mounted as the very last middleware in index.ts so it catches errors
 * forwarded by asyncHandler's .catch(next).
 */
export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  // Unexpected error — log the stack trace for debugging, return a safe 500.
  logger.error('Unhandled error reached global handler', {
    request_id: req.requestId,
    message:    err.message,
    stack:      err.stack,
  });
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
