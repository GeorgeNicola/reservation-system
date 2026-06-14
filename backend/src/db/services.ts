/**
 * db/services.ts — All SQL queries against the `services` table.
 *
 * Exposes one function used by every concurrency strategy to look up
 * a service's duration before computing the reservation's end_time.
 */

import { QueryRunner } from './pool';
import { ServiceRow } from '../types';

/**
 * Returns the service record for the given ID / clinic pair,
 * or null if the service does not exist or is inactive.
 *
 * Accepts a QueryRunner so it can be called both outside a transaction
 * (naive, queued strategies) and inside one (pessimistic, distributed).
 */
export async function getServiceByIdAndClinic(
  runner:    QueryRunner,
  serviceId: number,
  clinicId:  number,
): Promise<ServiceRow | null> {
  const result = await runner.query<ServiceRow>(
    `SELECT id, clinic_id, name, description, duration_minutes, price, is_active, created_at
     FROM   services
     WHERE  id = $1 AND clinic_id = $2 AND is_active = TRUE`,
    [serviceId, clinicId],
  );
  return result.rows[0] ?? null;
}

export async function getServices(clinicId?: number): Promise<ServiceRow[]> {
  // Using the shared pool for simple read queries
  const { pool } = await import('./pool');
  let query = `SELECT * FROM services WHERE is_active = TRUE`;
  const values: any[] = [];
  
  if (clinicId) {
    values.push(clinicId);
    query += ` AND clinic_id = $${values.length}`;
  }
  
  query += ` ORDER BY id ASC`;
  
  const result = await pool.query<ServiceRow>(query, values);
  return result.rows;
}

export async function createService(
  clinicId: number,
  name: string,
  durationMinutes: number,
  description?: string,
  price?: number
): Promise<ServiceRow> {
  const { pool } = await import('./pool');
  const result = await pool.query<ServiceRow>(
    `INSERT INTO services (clinic_id, name, duration_minutes, description, price)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [clinicId, name, durationMinutes, description || null, price || null]
  );
  return result.rows[0];
}
