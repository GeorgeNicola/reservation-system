import { pool } from './pool';
import { UserRow } from '../types';

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

export async function createUser(
  email: string,
  passwordHash: string,
  fullName: string,
  phone: string | null,
  role: 'patient' | 'doctor'
): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (email, password_hash, full_name, phone, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [email, passwordHash, fullName, phone, role]
  );
  return result.rows[0];
}
