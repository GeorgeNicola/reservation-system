/**
 * db.ts — Compatibility shim.
 *
 * The pool has been moved to db/pool.ts as part of the 3-layer refactor.
 * This file re-exports everything from the new location so any external
 * tooling or scripts that still import from './db' continue to work.
 */
export { pool, query, QueryRunner } from './db/pool';
