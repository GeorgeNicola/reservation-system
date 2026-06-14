/**
 * db/jobs.ts — All SQL queries against the `reservation_jobs` table.
 *
 * The reservation_jobs table implements the outbox pattern for the queued
 * strategy: the HTTP handler inserts a job row synchronously (so the client
 * gets a job ID), then the BullMQ worker processes it asynchronously.
 *
 * Functions that mutate job status accept a QueryRunner so that
 * updateJobCompleted can participate in the same transaction as the
 * reservation INSERT inside the worker (ensuring atomicity between the
 * reservation row and the job status update).
 *
 * Functions that only read (getJobById) or perform stand-alone updates
 * (insertJob, updateJobProcessing, updateJobFailed) use the pool directly.
 */

import { pool } from './pool';
import { QueryRunner } from './pool';
import { ReservationJobRow, InsertJobParams } from '../types';

// ─── Stand-alone operations (use pool directly) ───────────────────────────────

/**
 * Inserts a new job into reservation_jobs with status='pending'.
 * Called by queuedService immediately after receiving the HTTP request.
 */
export async function insertJob(params: InsertJobParams): Promise<ReservationJobRow> {
  const result = await pool.query<ReservationJobRow>(
    `INSERT INTO reservation_jobs
       (clinic_id, patient_id, service_id, start_time, end_time, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [
      params.clinicId,
      params.patientId,
      params.serviceId,
      params.startTime,
      params.endTime,
    ],
  );
  return result.rows[0];
}

/**
 * Fetches a job by its primary key. Returns null if not found.
 * Used by GET /jobs/:id to let clients poll for asynchronous results.
 */
export async function getJobById(jobId: number): Promise<ReservationJobRow | null> {
  const result = await pool.query<ReservationJobRow>(
    'SELECT * FROM reservation_jobs WHERE id = $1',
    [jobId],
  );
  return result.rows[0] ?? null;
}

/**
 * Marks a job as 'processing'. Called at the start of worker execution
 * to distinguish jobs that are actively being worked on from queued ones.
 */
export async function updateJobProcessing(runner: QueryRunner, jobId: number): Promise<void> {
  await runner.query(
    `UPDATE reservation_jobs SET status = 'processing' WHERE id = $1`,
    [jobId],
  );
}

// ─── Transactional operations (accept QueryRunner) ────────────────────────────

/**
 * Marks a job as 'completed' and links it to the created reservation.
 * Must run inside the same transaction as insertReservation so both
 * the reservation and the job update are committed atomically.
 */
export async function updateJobCompleted(
  runner:        QueryRunner,
  jobId:         number,
  reservationId: number,
): Promise<void> {
  await runner.query(
    `UPDATE reservation_jobs
     SET    status = 'completed',
            result_reservation_id = $1,
            processed_at = NOW()
     WHERE  id = $2`,
    [reservationId, jobId],
  );
}

/**
 * Marks a job as 'failed'. Called when the overlap check finds a conflict
 * or when an unexpected error aborts job processing.
 * Uses the pool (not a client) so it succeeds even after a ROLLBACK.
 */
export async function updateJobFailed(jobId: number): Promise<void> {
  await pool.query(
    `UPDATE reservation_jobs
     SET    status = 'failed',
            processed_at = NOW()
     WHERE  id = $1`,
    [jobId],
  );
}
