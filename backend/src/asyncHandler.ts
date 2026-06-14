/**
 * asyncHandler.ts — Async route handler wrapper.
 *
 * Express 4.x does not automatically catch rejected Promises from async route
 * handlers. Without this wrapper, an unhandled rejection would either crash
 * the process (Node.js 15+) or silently hang the HTTP request.
 *
 * Usage:
 *   router.post('/path', asyncHandler(async (req, res) => { ... }));
 *
 * Any error thrown inside the handler — whether an AppError thrown explicitly
 * or an unexpected runtime error — is forwarded to Express's error pipeline,
 * where errorMiddleware in errors.ts handles it uniformly.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export function asyncHandler(fn: AsyncRouteHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
