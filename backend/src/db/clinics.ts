import { pool } from './pool';
import { ClinicRow } from '../types';

export async function getClinics(): Promise<ClinicRow[]> {
  const result = await pool.query<ClinicRow>(
    `SELECT * FROM clinics ORDER BY id ASC`
  );
  return result.rows;
}

export async function createClinic(
  doctorId: number,
  name: string,
  specialty: string
): Promise<ClinicRow> {
  const result = await pool.query<ClinicRow>(
    `INSERT INTO clinics (doctor_id, name, specialty)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [doctorId, name, specialty]
  );
  return result.rows[0];
}
