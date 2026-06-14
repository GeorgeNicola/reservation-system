/**
 * db/pool.ts — PostgreSQL connection pool.
 *
 * A single Pool instance is shared across the entire application process.
 * max=20 is sized to accommodate two app instances (backend-1, backend-2) and the
 * worker connecting to the same PostgreSQL server simultaneously without
 * exhausting connections.
 *
 * QueryRunner is a structural interface satisfied by both Pool (for standalone
 * queries) and PoolClient (for queries inside an explicit transaction). DB layer
 * functions that may run in either context accept QueryRunner so they are
 * usable with or without a transaction.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import { logger } from '../logger';

export const pool = new Pool({
  connectionString:        config.databaseUrl,
  max:                     20,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  logger.error('Unexpected idle PostgreSQL client error', { message: err.message });
});

/**
 * Convenience wrapper around pool.query for one-off queries that do not
 * require an explicit client (i.e., outside a transaction).
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text:    string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

/**
 * Structural interface for a PostgreSQL query executor.
 * Both Pool and PoolClient conform to this shape, allowing db/ functions
 * to be called inside or outside a transaction without overloads.
 */
export interface QueryRunner {
  query<T extends QueryResultRow = QueryResultRow>(
    text:    string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
}

// Re-export PoolClient so services can type-annotate client variables.
export type { PoolClient };
