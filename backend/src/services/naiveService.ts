/**
 * services/naiveService.ts — Strategy 1: No concurrency control.
 *
 * This service deliberately omits any locking or transaction isolation.
 * The overlap check and the INSERT are two separate database operations
 * with NO synchronization between them.
 *
 * ── The race condition ────────────────────────────────────────────────────────
 * When two requests arrive concurrently for the same clinic and time slot:
 *
 *   Request A:  checkOverlap → (no conflict found)
 *   Request B:  checkOverlap → (no conflict found, A hasn't inserted yet)
 *   Request A:  INSERT reservation ✓
 *   Request B:  INSERT reservation ✓  ← double booking!
 *
 * Both requests see an empty slot, both insert successfully, and the slot
 * ends up with two confirmed reservations. This is the classic TOCTOU
 * (time-of-check / time-of-use) race condition.
 *
 * Under k6 load (200 VUs, same clinic + time slot) this scenario reliably
 * produces double bookings, which the dissertation measures with the
 * GET /stats/double-bookings endpoint.
 */

import { pool } from '../db/pool';
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

  // Step 1: Read service to obtain duration_minutes.
  const service = await getServiceByIdAndClinic(pool, service_id, clinic_id);
  if (!service) {
    return fail(404, 'NOT_FOUND', 'Service not found or inactive');
  }

  // Step 2: Compute end_time from the service duration.
  const endDate = new Date(startDate.getTime() + service.duration_minutes * 60_000);

  // Step 3: Check for overlapping reservations — NOT protected by any lock.
  const hasOverlap = await checkOverlap(
    pool,
    clinic_id,
    startDate.toISOString(),
    endDate.toISOString(),
  );
  if (hasOverlap) {
    return fail(409, 'CONFLICT', 'Time slot not available');
  }

  // Step 4: Insert the reservation.
  // Between step 3 and step 4 another request may have inserted for the same
  // slot, producing a double booking. This is intentional for the demo.
  const reservation = await insertReservation(pool, {
    clinicId:    clinic_id,
    patientId:   patient_id,
    serviceId:   service_id,
    startTime:   startDate.toISOString(),
    endTime:     endDate.toISOString(),
    processedBy: config.instanceId,
  });

  logger.info('Reservation created (naive)', {
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
    strategy:              'naive',
  });
}
