/**
 * services/distributedService.ts — Strategy 3: Distributed locking via Redis.
 *
 * Uses an application-level lock stored in Redis to serialize reservation
 * attempts for the same clinic across multiple application instances.
 *
 * ── Why Redis, not advisory locks? ────────────────────────────────────────────
 * PostgreSQL advisory locks are process-local — they only serialize requests
 * that reach the same PostgreSQL backend connection. When two Node.js instances
 * (backend-1, backend-2) share a connection pool, advisory locks still work correctly
 * because pg_advisory_xact_lock is per-database-server. However, the Redis
 * approach demonstrates how distributed systems use an external coordinator
 * to achieve consensus across stateless application instances.
 *
 * ── Protocol ──────────────────────────────────────────────────────────────────
 * 1. Generate a UUID token unique to this request (serves as a fencing token
 *    at the Redis level).
 * 2. Try SET lock:clinic:{id} {token} EX {ttl} NX.
 *    Retry with exponential back-off up to MAX_RETRIES times.
 * 3. If the lock cannot be acquired → return 503.
 * 4. Fetch the next value of lock_fence_seq (a PostgreSQL sequence) to obtain
 *    a monotonically increasing fencing token that can detect stale writes.
 * 5. Perform the overlap check and reservation INSERT inside a DB transaction.
 * 6. In a finally block, release the Redis lock via an atomic Lua script.
 *    The client is also released here, ensuring both resources are freed.
 *
 * All lock mechanism details are encapsulated in services/lockService.ts.
 */

import { pool, PoolClient } from '../db/pool';
import { getServiceByIdAndClinic } from '../db/services';
import { checkOverlap, insertReservation } from '../db/reservations';
import { makeLockKey, makeToken, acquireLock, releaseLock } from './lockService';
import { CreateReservationBody, ReservationResponse, Result, ok, fail } from '../types';
import { config } from '../config';
import { logger } from '../logger';

export async function book(
  body:      CreateReservationBody,
  requestId: string,
): Promise<Result<ReservationResponse>> {
  const { clinic_id, patient_id, service_id, start_time } = body;
  const startDate = new Date(start_time);

  // Step 1: Prepare lock identifiers.
  const lockKey = makeLockKey(clinic_id);
  const token   = makeToken();

  // Step 2: Try to acquire the distributed lock.
  const acquired = await acquireLock(lockKey, token);
  if (!acquired) {
    logger.warn('Could not acquire distributed lock', {
      request_id: requestId,
      clinic_id,
    });
    return fail(503, 'SERVICE_UNAVAILABLE', 'Service busy, retry later');
  }

  // At this point we hold the Redis lock for this clinic.
  // Use a nullable client variable so the finally block can check whether
  // pool.connect() succeeded before calling client.release().
  let client: PoolClient | null = null;

  try {
    // Step 3: Get fencing token from PostgreSQL sequence.
    // The monotonically increasing value proves ordering if the lock expires
    // and is re-acquired by another request. Stored in processed_by_instance.
    const fenceResult = await pool.query<{ nextval: string }>(
      "SELECT nextval('lock_fence_seq') AS nextval",
    );
    const fencingToken = fenceResult.rows[0].nextval;

    // Step 4: Open a DB transaction.
    client = await pool.connect();
    await client.query('BEGIN');

    // Step 5a: Read service duration.
    const service = await getServiceByIdAndClinic(client, service_id, clinic_id);
    if (!service) {
      await client.query('ROLLBACK');
      return fail(404, 'NOT_FOUND', 'Service not found or inactive');
    }

    // Step 5b: Compute end_time.
    const endDate = new Date(startDate.getTime() + service.duration_minutes * 60_000);

    // Step 6: Check for overlaps (safe — we hold the Redis lock).
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

    // Step 7: Insert the reservation.
    const reservation = await insertReservation(client, {
      clinicId:    clinic_id,
      patientId:   patient_id,
      serviceId:   service_id,
      startTime:   startDate.toISOString(),
      endTime:     endDate.toISOString(),
      // Record the fencing token alongside the instance ID for auditability.
      processedBy: `${config.instanceId}|fence=${fencingToken}`,
    });

    // Step 8: Commit.
    await client.query('COMMIT');

    logger.info('Reservation created (distributed)', {
      request_id:     requestId,
      clinic_id,
      reservation_id: reservation.id,
      fencing_token:  fencingToken,
    });

    return ok({
      reservation_id:        reservation.id,
      clinic_id:             reservation.clinic_id,
      patient_id:            reservation.patient_id,
      start_time:            reservation.start_time,
      end_time:              reservation.end_time,
      processed_by_instance: reservation.processed_by_instance,
      strategy:              'distributed',
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => { /* ignore */ });
    }
    throw err;
  } finally {
    // Always release the Redis lock first, then the DB client.
    // This order ensures we release the critical resource (the lock) even
    // if client.release() were to throw.
    await releaseLock(lockKey, token);
    if (client) client.release();
  }
}
