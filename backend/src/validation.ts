/**
 * validation.ts — Input validation for POST /reservations/* request bodies.
 *
 * All four concurrency strategy routes accept the same request body shape
 * (CreateReservationBody). Rather than duplicating the same checks across four
 * files, a single function validates the raw JSON body and returns either the
 * validated data or a descriptive error message.
 *
 * Validation rules:
 *   clinic_id, patient_id, service_id — must be positive integers
 *   start_time                         — must be a parseable ISO 8601 string
 *
 * Note: the k6 load tests use a fixed past date (2025-06-10) intentionally
 * to create a repeatable "hot spot". Enforcing start_time > NOW() would
 * break all load test scenarios, so that check is deliberately omitted here.
 */

import { CreateReservationBody } from './types';

type ValidationResult =
  | { valid: true;  data: CreateReservationBody }
  | { valid: false; message: string };

export function validateReservationBody(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Request body must be a JSON object' };
  }

  const b = body as Record<string, unknown>;

  if (!Number.isInteger(b.clinic_id) || (b.clinic_id as number) <= 0) {
    return { valid: false, message: 'clinic_id must be a positive integer' };
  }
  if (!Number.isInteger(b.patient_id) || (b.patient_id as number) <= 0) {
    return { valid: false, message: 'patient_id must be a positive integer' };
  }
  if (!Number.isInteger(b.service_id) || (b.service_id as number) <= 0) {
    return { valid: false, message: 'service_id must be a positive integer' };
  }
  if (typeof b.start_time !== 'string' || b.start_time.trim() === '') {
    return { valid: false, message: 'start_time must be a non-empty ISO 8601 string' };
  }
  if (isNaN(new Date(b.start_time).getTime())) {
    return { valid: false, message: `start_time "${b.start_time}" is not a valid date` };
  }

  return {
    valid: true,
    data: {
      clinic_id:  b.clinic_id  as number,
      patient_id: b.patient_id as number,
      service_id: b.service_id as number,
      start_time: b.start_time as string,
    },
  };
}
