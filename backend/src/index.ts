/**
 * index.ts — Express application entry point.
 *
 * Responsibilities:
 *   - Configure global middleware (CORS, JSON body parsing, requestId, instance header)
 *   - Mount route modules
 *   - Register the global error handler (must be last)
 *   - Start the HTTP server
 *   - Handle graceful shutdown on SIGTERM / SIGINT
 */

import { randomUUID } from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

import { config }          from './config';
import { logger }          from './logger';
import { errorMiddleware } from './errors';
import { asyncHandler }    from './asyncHandler';
import { pool }            from './db/pool';
import { getByClinicAndWindow } from './db/reservations';

import naiveRouter       from './routes/naive';
import pessimisticRouter from './routes/pessimistic';
import distributedRouter from './routes/distributed';
import queuedRouter      from './routes/queued';
import jobsRouter        from './routes/jobs';
import authRouter        from './routes/auth';
import reservationsListRouter from './routes/reservationsList';
import clinicsRouter     from './routes/clinics';
import servicesRouter    from './routes/services';

const app = express();

// ─── Global middleware ────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

/** Generate a unique ID for every request — included in all log lines. */
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.requestId = randomUUID();
  next();
});

/** Expose which container handled the request — proves load balancing works. */
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Instance-ID', config.instanceId);
  next();
});

// ─── Route modules ────────────────────────────────────────────────────────────

app.use('/reservations', naiveRouter);
app.use('/reservations', pessimisticRouter);
app.use('/reservations', distributedRouter);
app.use('/reservations', queuedRouter);
app.use('/',             jobsRouter);
app.use('/auth',         authRouter);
app.use('/reservations/list', reservationsListRouter);
app.use('/clinics',      clinicsRouter);
app.use('/services',     servicesRouter);

// ─── Utility endpoints ────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', instance: config.instanceId });
});

/**
 * GET /stats/double-bookings?clinic_id=1&start_time=...&end_time=...
 *
 * Returns all confirmed reservations that overlap the given window for a clinic.
 * A result count > 1 is evidence of a double booking. Used after the naive
 * k6 load test scenario to quantify how many double bookings occurred.
 */
app.get(
  '/stats/double-bookings',
  asyncHandler(async (req: Request, res: Response) => {
    const { clinic_id, start_time, end_time } = req.query;

    if (!clinic_id || !start_time || !end_time) {
      res.status(400).json({
        error: 'Query params required: clinic_id, start_time, end_time',
        code:  'BAD_REQUEST',
      });
      return;
    }

    const reservations = await getByClinicAndWindow(
      Number(clinic_id),
      String(start_time),
      String(end_time),
    );

    res.json({
      clinic_id:               Number(clinic_id),
      window:                  { start_time, end_time },
      overlap_count:           reservations.length,
      double_booking_detected: reservations.length > 1,
      reservations,
    });
  }),
);

// ─── Global error handler (must be registered last) ──────────────────────────

app.use(errorMiddleware);

// ─── Server startup ───────────────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal} — shutting down gracefully`);

  server.close(async () => {
    try {
      await pool.end();
      logger.info('PostgreSQL pool closed');
    } catch (err) {
      logger.error('Error closing PostgreSQL pool', { message: (err as Error).message });
    }
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long.
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));

export default app;
