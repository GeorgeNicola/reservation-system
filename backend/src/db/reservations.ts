/**
 * db/reservations.ts — All SQL queries against the `reservations` table.
 *
 * Three functions:
 *   checkOverlap           — used inside every concurrency strategy
 *   insertReservation      — used inside every concurrency strategy
 *   getByClinicAndWindow   — used by the /stats/double-bookings endpoint
 *
 * Both checkOverlap and insertReservation accept a QueryRunner so they can
 * be called both inside a transaction (pessimistic, distributed strategies)
 * and outside one (naive strategy). getByClinicAndWindow is read-only and
 * always uses the pool directly.
 *
 * The overlap detection predicate is the core of the dissertation's conflict
 * analysis. Two intervals [s1,e1) and [s2,e2) overlap if and only if:
 *   s1 < e2  AND  e1 > s2
 * This is Allen's interval overlap condition, applied as a WHERE clause.
 */

import { QueryRunner, pool } from './pool';
import { ReservationRow, InsertReservationParams } from '../types';

/**
 * Returns true if at least one confirmed reservation for the same clinic
 * overlaps the given [startTime, endTime) window.
 *
 * Called by every strategy BEFORE inserting a new reservation.
 * In the naive strategy this check is NOT protected by any lock, which is
 * exactly the race condition the dissertation demonstrates.
 */
export async function checkOverlap(
  runner:    QueryRunner,
  clinicId:  number,
  startTime: string,
  endTime:   string,
): Promise<boolean> {
  const result = await runner.query(
    `SELECT id
     FROM   reservations
     WHERE  clinic_id  = $1
       AND  status    != 'cancelled'
       AND  start_time < $3
       AND  end_time   > $2`,
    [clinicId, startTime, endTime],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Inserts a new confirmed reservation and returns the full created row.
 * The processed_by_instance column records which app container handled
 * the request, proving the Nginx load balancer is distributing traffic.
 */
export async function insertReservation(
  runner: QueryRunner,
  params: InsertReservationParams,
): Promise<ReservationRow> {
  const result = await runner.query<ReservationRow>(
    `INSERT INTO reservations
       (clinic_id, patient_id, service_id, start_time, end_time, processed_by_instance)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      params.clinicId,
      params.patientId,
      params.serviceId,
      params.startTime,
      params.endTime,
      params.processedBy,
    ],
  );
  return result.rows[0];
}

/**
 * Returns all confirmed reservations that overlap a given clinic/window.
 * Used by GET /stats/double-bookings to count overlapping rows after a
 * load test — a count > 1 is evidence of a double booking.
 */
export async function getByClinicAndWindow(
  clinicId:  number,
  startTime: string,
  endTime:   string,
): Promise<ReservationRow[]> {
  const result = await pool.query<ReservationRow>(
    `SELECT *
     FROM   reservations
     WHERE  clinic_id  = $1
       AND  status    != 'cancelled'
       AND  start_time < $3
       AND  end_time   > $2
     ORDER BY created_at`,
    [clinicId, startTime, endTime],
  );
  return result.rows;
}

/**
 * Returns a list of reservations with optional filtering by clinic_id or patient_id.
 * Results are sorted by start_time descending by default.
 */
export async function getReservations(
  clinicId?: number,
  patientId?: number,
): Promise<ReservationRow[]> {
  let query = `SELECT * FROM reservations WHERE 1=1`;
  const values: any[] = [];
  
  if (clinicId) {
    values.push(clinicId);
    query += ` AND clinic_id = $${values.length}`;
  }
  
  if (patientId) {
    values.push(patientId);
    query += ` AND patient_id = $${values.length}`;
  }
  
  query += ` ORDER BY start_time DESC`;
  
  const result = await pool.query<ReservationRow>(query, values);
  return result.rows;
}
