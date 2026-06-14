/**
 * services/pessimisticService.ts — Strategy 2: Pessimistic locking.
 *
 * Uses PostgreSQL's advisory lock mechanism to serialize all reservation
 * attempts for the same clinic at the database level.
 *
 * ── How it works ──────────────────────────────────────────────────────────────
 * pg_advisory_xact_lock(clinic_id) places an exclusive lock identified by the
 * clinic's integer ID. The lock is held for the duration of the transaction
 * and released automatically on COMMIT or ROLLBACK — no explicit unlock call
 * is needed, and no lock can "leak" if the application crashes.
 *
 * All concurrent requests for the same clinic_id queue at the lock line;
 * they are processed one at a time in the order PostgreSQL grants the lock.
 * Because the overlap check and the INSERT run inside the same locked
 * transaction, it is impossible for two requests to see the slot as empty
 * simultaneously.
 *
 * ── Trade-offs ────────────────────────────────────────────────────────────────
 * Advantage:   Zero double bookings; correctness guaranteed by the DB engine.
 * Disadvantage: Each request holds a DB connection for the full duration of
 *               lock contention. Under 200 VUs this can exhaust the pool if
 *               lock wait times exceed the pool's connectionTimeoutMillis.
 *               Response latency grows linearly with queue depth.
 */

import { pool, PoolClient } from '../db/pool';
import { getServiceByIdAndClinic } from '../db/services';
import { checkOverlap, insertReservation } from '../db/reservations';
import { CreateReservationBody, ReservationResponse, Result, ok, fail } from '../types';
import { config } from '../config';
import { logger } from '../logger';

export async function book(
  body:      CreateReservationBody,
  requestId: string,
): Promise<Result<ReservationResponse>> {
  const { clinic_id, patient_id, service_id, start_time } = body;
  const startDate = new Date(start_time);

  // Acquire a dedicated client — held for the entire lock duration.
  const client: PoolClient = await pool.connect();

  try {
    // Step 1: Open a transaction.
    await client.query('BEGIN');

    // Step 2: Acquire the advisory lock (blocks until granted).
    // pg_advisory_xact_lock accepts a bigint; clinic_id is cast automatically.
    await client.query('SELECT pg_advisory_xact_lock($1)', [clinic_id]);

    // Step 3: Read service duration (safe — we hold the lock).
    const service = await getServiceByIdAndClinic(client, service_id, clinic_id);
    if (!service) {
      await client.query('ROLLBACK');
      return fail(404, 'NOT_FOUND', 'Service not found or inactive');
    }

    // Step 4: Compute end_time.
    const endDate = new Date(startDate.getTime() + service.duration_minutes * 60_000);

    // Step 5: Check for overlaps (safe — serialized by the advisory lock).
    const hasOverlap = await checkOverlap(
      client,
      clinic_id,
      startDate.toISOString(),
      endDate.toISOString(),
    );
    if (hasOverlap) {
      await client.query('ROLLBACK');
      return fail(409, 'CONFLICT', 'Time slot not available');
    }

    // Step 6: Insert the reservation.
    const reservation = await insertReservation(client, {
      clinicId:    clinic_id,
      patientId:   patient_id,
      serviceId:   service_id,
      startTime:   startDate.toISOString(),
      endTime:     endDate.toISOString(),
      processedBy: config.instanceId,
    });

    // Step 7: Commit — advisory lock is released automatically here.
    await client.query('COMMIT');

    logger.info('Reservation created (pessimistic)', {
      request_id:     requestId,
      clinic_id,
      reservation_id: reservation.id,
    });

    return ok({
      reservation_id:        reservation.id,
      clinic_id:             reservation.clinic_id,
      patient_id:            reservation.patient_id,
      start_time:            reservation.start_time,
      end_time:              reservation.end_time,
      processed_by_instance: reservation.processed_by_instance,
      strategy:              'pessimistic',
    });
  } catch (err) {
    // Roll back any partial work before propagating the unexpected error.
    await client.query('ROLLBACK').catch(() => { /* ignore rollback error */ });
    throw err;
  } finally {
    // The client MUST be released regardless of success or failure,
    // otherwise the pool will eventually run out of connections.
    client.release();
  }
}
