/**
 * routes/distributed.ts — HTTP handler for Strategy 3 (distributed locking).
 *
 * This file contains only HTTP concerns:
 *   1. Validate the request body (delegate to validation.ts)
 *   2. Call the service (delegate to distributedService.ts)
 *   3. Map the Result<T> to an HTTP response
 *
 * All business logic — the Redis lock acquisition, the fencing token, the
 * DB transaction, and the atomic Lua release — lives in:
 *   services/distributedService.ts (orchestration)
 *   services/lockService.ts        (lock mechanism)
 */

import { Router } from 'express';
import { asyncHandler } from '../asyncHandler';
import { validateReservationBody } from '../validation';
import * as distributedService from '../services/distributedService';

const router = Router();

router.post(
  '/distributed-lock',
  asyncHandler(async (req, res) => {
    // Step 1: Validate
    const validation = validateReservationBody(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.message, code: 'BAD_REQUEST' });
      return;
    }

    // Step 2: Execute strategy
    const result = await distributedService.book(validation.data, req.requestId);

    // Step 3: Respond
    if (!result.ok) {
      res.status(result.status).json({ error: result.message, code: result.code });
      return;
    }
    res.status(201).json(result.value);
  }),
);

export default router;
