/**
 * worker/reservationWorker.ts — BullMQ worker process for the queued strategy.
 *
 * This module runs as a standalone process in the 'worker' Docker service:
 *   node dist/worker/reservationWorker.js
 *
 * ── Architecture ──────────────────────────────────────────────────────────────
 * At startup, the worker queries all active clinic IDs from the database and
 * creates one BullMQ Worker per clinic queue. Each worker is configured with
 * concurrency=1, meaning jobs for a given clinic are processed one at a time
 * in strict FIFO order. Clinics are isolated from each other — processing for
 * clinic 1 does not block processing for clinic 2.
 *
 * ── Idempotency ───────────────────────────────────────────────────────────────
 * Before processing a job, the worker checks whether the job's
 * result_reservation_id is already set (populated by a previous run). If it
 * is, the job is skipped. This prevents duplicate reservations if BullMQ
 * retries a job that already partially succeeded.
 *
 * ── Atomicity ─────────────────────────────────────────────────────────────────
 * The reservation INSERT and the job status update (to 'completed') run inside
 * the same PostgreSQL transaction. If either fails, both are rolled back,
 * leaving the system in a consistent state.
 *
 * ── Why concurrency=1 prevents double bookings ────────────────────────────────
 * With a single worker processing one job at a time per clinic, the overlap
 * check → INSERT sequence is inherently serialized. No two jobs for the same
 * clinic can reach the overlap check simultaneously, so no locking is needed
 * inside the worker beyond the BullMQ queue itself.
 */

import { Worker, Job } from 'bullmq';
import { pool }                from '../db/pool';
import { PoolClient }          from '../db/pool';
import { checkOverlap, insertReservation } from '../db/reservations';
import { getJobById, updateJobProcessing, updateJobCompleted, updateJobFailed } from '../db/jobs';
import { config }              from '../config';
import { logger }              from '../logger';

const INSTANCE_ID = config.instanceId;

logger.info('Reservation worker starting');

// ─── Job data shape ───────────────────────────────────────────────────────────

interface ReservationJobData {
  job_id:     number;
  clinic_id:  number;
  patient_id: number;
  service_id: number;
  start_time: string;
  end_time:   string;
}

// ─── BullMQ connection (plain URL — NOT the shared ioredis client) ────────────

/** BullMQ creates its own internal ioredis connections from this URL config. */
const bullmqConnection = { url: config.redisUrl };

// ─── Job processor ────────────────────────────────────────────────────────────

async function processReservationJob(job: Job<ReservationJobData>): Promise<void> {
  const { job_id, clinic_id, patient_id, service_id, start_time, end_time } = job.data;
  const jobStartMs = Date.now();

  logger.info('Job picked up', { job_id, clinic_id });

  // ── Idempotency guard ────────────────────────────────────────────────────
  // Check the outbox record before doing any work. If result_reservation_id
  // is already set, a previous execution succeeded and this is a duplicate run.
  const existingJob = await getJobById(job_id);

  if (!existingJob) {
    logger.warn('Job record not found in DB — skipping', { job_id });
    return;
  }
  if (existingJob.result_reservation_id !== null) {
    logger.info('Job already completed — skipping (idempotency)', {
      job_id,
      reservation_id: existingJob.result_reservation_id,
    });
    return;
  }
  if (existingJob.status === 'failed') {
    logger.info('Job previously marked failed — skipping', { job_id });
    return;
  }

  // ── Mark as processing ───────────────────────────────────────────────────
  await updateJobProcessing(pool, job_id);

  // ── Transaction: overlap check + reservation insert ──────────────────────
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    // Overlap check — safe because concurrency=1 serializes jobs per clinic.
    const hasOverlap = await checkOverlap(client, clinic_id, start_time, end_time);

    if (hasOverlap) {
      await client.query('ROLLBACK');
      await updateJobFailed(job_id);

      const durationMs = Date.now() - jobStartMs;
      logger.info('Job failed — time slot conflict', {
        job_id,
        clinic_id,
        duration_ms: durationMs,
      });
      return;
    }

    // Insert the reservation.
    const reservation = await insertReservation(client, {
      clinicId:    clinic_id,
      patientId:   patient_id,
      serviceId:   service_id,
      startTime:   start_time,
      endTime:     end_time,
      processedBy: INSTANCE_ID,
    });

    // Mark the job as completed inside the same transaction (atomicity).
    await updateJobCompleted(client, job_id, reservation.id);

    await client.query('COMMIT');

    const durationMs = Date.now() - jobStartMs;
    logger.info('Job completed — reservation created', {
      job_id,
      clinic_id,
      patient_id,
      reservation_id: reservation.id,
      duration_ms:    durationMs,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { /* ignore */ });

    // Mark the job as failed outside the rolled-back transaction.
    await updateJobFailed(job_id).catch((updateErr) => {
      logger.error('Failed to mark job as failed after error', {
        job_id,
        message: (updateErr as Error).message,
      });
    });

    logger.error('Job threw unexpected error', {
      job_id,
      clinic_id,
      message: (err as Error).message,
    });

    throw err; // Inform BullMQ that the job failed.
  } finally {
    client.release();
  }
}

// ─── Worker registry ──────────────────────────────────────────────────────────

const workers: Worker[] = [];

async function startWorkers(): Promise<void> {
  // Discover all active clinic IDs at startup.
  const result = await pool.query<{ id: number }>(
    'SELECT id FROM clinics WHERE is_active = TRUE ORDER BY id',
  );
  const clinicIds = result.rows.map((r) => r.id);

  if (clinicIds.length === 0) {
    logger.warn('No active clinics found — worker is idle');
    return;
  }

  logger.info(`Starting workers for ${clinicIds.length} clinic(s)`, {
    clinic_ids: clinicIds.join(','),
  });

  for (const clinicId of clinicIds) {
    const queueName = `reservations-clinic-${clinicId}`;

    const worker = new Worker<ReservationJobData>(
      queueName,
      processReservationJob,
      {
        connection:   bullmqConnection,
        concurrency:  1,       // Critical: FIFO serial processing per clinic
        lockDuration: 30_000,  // 30 s lock prevents other workers stealing jobs
      },
    );

    worker.on('completed', (completedJob) => {
      logger.info('BullMQ job completed', {
        queue:  queueName,
        job_id: completedJob.id,
      });
    });

    worker.on('failed', (failedJob, err) => {
      logger.error('BullMQ job failed', {
        queue:   queueName,
        job_id:  failedJob?.id,
        message: err.message,
      });
    });

    worker.on('error', (err) => {
      logger.error('BullMQ worker error', {
        queue:   queueName,
        message: err.message,
      });
    });

    workers.push(worker);
    logger.info(`Worker started`, { queue: queueName, concurrency: 1 });
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal} — shutting down workers`);

  // Close all BullMQ workers (drains in-flight jobs first).
  await Promise.all(workers.map((w) => w.close()));

  // Close the PostgreSQL pool.
  await pool.end();

  logger.info('All workers stopped');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));

// ─── Bootstrap ────────────────────────────────────────────────────────────────

startWorkers().catch((err) => {
  logger.error('Fatal error during worker startup', { message: (err as Error).message });
  process.exit(1);
});
