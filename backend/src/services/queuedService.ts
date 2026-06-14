/**
 * services/queuedService.ts — Strategy 4: FIFO queue via BullMQ.
 *
 * Instead of blocking the HTTP response until the reservation is persisted,
 * this strategy accepts the request immediately (HTTP 202 Accepted) and
 * delegates the conflict check and INSERT to an asynchronous worker.
 *
 * ── How it works ──────────────────────────────────────────────────────────────
 * 1. The service duration is looked up immediately so end_time is computed
 *    before the job is enqueued (the worker does not need to re-query it).
 * 2. A row is inserted into reservation_jobs with status='pending'. This is
 *    the "outbox" record that the client polls via GET /jobs/:id.
 * 3. A BullMQ job is enqueued to the queue 'reservations:clinic:{clinicId}'.
 *    The job ID is deterministically set to 'rj-{job_id}' for idempotency.
 * 4. The HTTP handler returns 202 immediately with the job_id.
 *
 * ── Why one queue per clinic? ─────────────────────────────────────────────────
 * Each clinic has its own BullMQ queue. The worker runs with concurrency=1
 * per queue, guaranteeing that reservations for a given clinic are processed
 * strictly in arrival order (FIFO). Clinics do not interfere with each other —
 * clinic 1 and clinic 2 can process jobs in parallel.
 *
 * ── BullMQ connection note ────────────────────────────────────────────────────
 * BullMQ must NOT receive the shared redisClient instance; it uses a plain
 * { url } config to create its own internal Redis connection. See redis.ts.
 */

import { Queue } from 'bullmq';
import { pool } from '../db/pool';
import { getServiceByIdAndClinic } from '../db/services';
import { insertJob } from '../db/jobs';
import { CreateReservationBody } from '../types';
import { config } from '../config';
import { logger } from '../logger';

/** BullMQ connection config — BullMQ uses its own bundled ioredis internally. */
const bullmqConnection = { url: config.redisUrl };

/** In-process cache of Queue instances to avoid recreating them per request. */
const queueCache = new Map<number, Queue>();

function getQueue(clinicId: number): Queue {
  const cached = queueCache.get(clinicId);
  if (cached) return cached;

  const q = new Queue(`reservations-clinic-${clinicId}`, {
    connection: bullmqConnection,
    defaultJobOptions: {
      removeOnComplete: 100, // Keep last 100 completed job records in Redis
      removeOnFail:     500, // Keep last 500 failed job records for debugging
      attempts:         1,   // The worker handles failure semantics explicitly
    },
  });

  queueCache.set(clinicId, q);
  return q;
}

/** Queued booking response — different from ReservationResponse (202, not 201). */
export interface QueuedBookingResponse {
  job_id:   number;
  status:   'pending';
  message:  string;
  poll_url: string;
}

export async function book(
  body:      CreateReservationBody,
  requestId: string,
): Promise<{ ok: true; value: QueuedBookingResponse } | { ok: false; status: number; code: string; message: string }> {
  const { clinic_id, patient_id, service_id, start_time } = body;
  const startDate = new Date(start_time);

  // Step 1: Look up the service to compute end_time synchronously.
  const service = await getServiceByIdAndClinic(pool, service_id, clinic_id);
  if (!service) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Service not found or inactive' };
  }

  // Step 2: Compute end_time.
  const endDate = new Date(startDate.getTime() + service.duration_minutes * 60_000);

  // Step 3: Insert the outbox record so the client has a job ID to poll.
  const jobRow = await insertJob({
    clinicId:  clinic_id,
    patientId: patient_id,
    serviceId: service_id,
    startTime: startDate.toISOString(),
    endTime:   endDate.toISOString(),
  });

  // Step 4: Enqueue the job in BullMQ.
  const queue = getQueue(clinic_id);
  await queue.add(
    'process-reservation',
    {
      job_id:     jobRow.id,
      clinic_id,
      patient_id,
      service_id,
      start_time: startDate.toISOString(),
      end_time:   endDate.toISOString(),
    },
    {
      jobId: `rj-${jobRow.id}`, // Deterministic ID prevents duplicate enqueuing
    },
  );

  logger.info('Reservation job enqueued', {
    request_id: requestId,
    clinic_id,
    job_id:     jobRow.id,
  });

  return {
    ok: true,
    value: {
      job_id:   jobRow.id,
      status:   'pending',
      message:  'Reservation queued for processing',
      poll_url: `/jobs/${jobRow.id}`,
    },
  };
}
