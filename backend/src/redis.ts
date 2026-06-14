/**
 * redis.ts — Shared ioredis client for the application layer.
 *
 * IMPORTANT — BullMQ compatibility note:
 * BullMQ bundles its own private copy of ioredis. Passing this client
 * instance directly to a BullMQ Queue or Worker constructor causes a
 * TypeScript structural type mismatch because the two ioredis copies have
 * incompatible internal AbstractConnector class hierarchies.
 *
 * The fix: BullMQ queues and workers must use a plain { url } connection
 * config object (see services/lockService.ts and services/queuedService.ts).
 * BullMQ then creates its own internal Redis connection from the URL.
 *
 * This client is used only by:
 *   - services/lockService.ts  (distributed locking strategy)
 *   - index.ts graceful shutdown
 */

import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger';

export const redisClient = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck:     true,
  lazyConnect:          false,
});

redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('error', (err) => {
  logger.error('Redis client error', { message: err.message });
});
