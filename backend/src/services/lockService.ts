/**
 * services/lockService.ts — Redis distributed lock (single-node Redlock).
 *
 * This module encapsulates the entire distributed locking mechanism so the
 * dissertation reader can understand it in one place.
 *
 * ── How it works ──────────────────────────────────────────────────────────────
 * Acquiring a lock:
 *   SET lock:clinic:{id} {uuid-token} EX {ttl} NX
 *   - EX sets a Time-To-Live so the lock self-expires if the holder crashes.
 *   - NX (Not eXists) makes the SET conditional: it only succeeds if the key
 *     does not already exist. This is atomic at the Redis level.
 *   - The UUID token ensures we only release a lock WE own (fencing).
 *   - If the SET returns null (lock held by another), we wait with exponential
 *     back-off and retry up to MAX_RETRIES times.
 *
 * Releasing a lock:
 *   A Lua script runs atomically: it reads the key, confirms the value matches
 *   our token, and only then deletes it. This prevents accidentally deleting a
 *   lock acquired by a different request after our TTL expired.
 *
 * Fencing tokens:
 *   After acquiring the lock, distributedService fetches the next value of
 *   lock_fence_seq (a PostgreSQL sequence). Monotonically increasing tokens
 *   can be used to detect and reject stale requests even if the lock expired.
 *   For this demo the token is recorded in processed_by_instance for auditability.
 *
 * ── Single-node vs. Redlock ───────────────────────────────────────────────────
 * Full Redlock requires a quorum of Redis nodes to tolerate node failures.
 * For a single Redis node (as in this demo) the simpler SET NX EX pattern
 * provides the same safety properties; Redlock would add complexity without
 * benefit.
 */

import { v4 as uuidv4 } from 'uuid';
import { redisClient } from '../redis';
import { logger } from '../logger';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Key prefix in Redis. Full key: "lock:clinic:{clinicId}" */
export const LOCK_KEY_PREFIX = 'lock:clinic:';

/** How long (seconds) a lock lives before Redis auto-expires it. */
export const LOCK_TTL_SECONDS = 5;

/** Maximum attempts to acquire the lock before giving up. */
export const MAX_RETRIES = 5;

/** Base delay (ms) for the first retry. Doubles each attempt plus jitter. */
export const BASE_BACKOFF_MS = 100;

/**
 * Lua script for atomic lock release.
 * Reads the key, checks the value matches our token, and DELetes atomically.
 * Returns 1 if the lock was deleted, 0 if it was already gone or owned by
 * a different holder (i.e., our TTL expired and another request took over).
 */
export const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

// ─── Public API ───────────────────────────────────────────────────────────────

export function makeLockKey(clinicId: number): string {
  return `${LOCK_KEY_PREFIX}${clinicId}`;
}

export function makeToken(): string {
  return uuidv4();
}

/**
 * Tries to acquire a distributed lock with exponential back-off.
 *
 * @returns true if the lock was acquired before MAX_RETRIES was exceeded.
 */
export async function acquireLock(lockKey: string, token: string): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // SET key value EX ttl NX — atomic conditional set with expiry
    const reply = await redisClient.set(lockKey, token, 'EX', LOCK_TTL_SECONDS, 'NX');

    if (reply === 'OK') {
      logger.debug('Lock acquired', { lock_key: lockKey, attempt });
      return true;
    }

    // Back-off: exponential delay + random jitter to reduce thundering herd
    const delayMs = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 50;
    await sleep(delayMs);
  }

  logger.warn('Failed to acquire lock after max retries', {
    lock_key:    lockKey,
    max_retries: MAX_RETRIES,
  });
  return false;
}

/**
 * Releases the lock atomically using the Lua script.
 * Safe to call even if the TTL has already expired — the script is a no-op
 * when the key is missing or owned by a different token.
 */
export async function releaseLock(lockKey: string, token: string): Promise<void> {
  try {
    await redisClient.eval(RELEASE_LOCK_LUA, 1, lockKey, token);
    logger.debug('Lock released', { lock_key: lockKey });
  } catch (err) {
    // Log but do not throw: the TTL will expire the lock anyway.
    logger.error('Failed to release lock (will expire via TTL)', {
      lock_key: lockKey,
      message:  (err as Error).message,
    });
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
