/**
 * routes/queued.ts — HTTP handler for Strategy 4 (FIFO queue).
 *
 * This file contains only HTTP concerns:
 *   1. Validate the request body (delegate to validation.ts)
 *   2. Call the service (delegate to queuedService.ts)
 *   3. Return HTTP 202 Accepted (not 201) — the reservation is not yet created
 *
 * The queued strategy is the only one that returns 202 instead of 201.
 * The client must poll GET /jobs/:id (handled in routes/jobs.ts) to learn
 * whether the reservation was ultimately created or rejected.
 *
 * All business logic — the outbox insert, the BullMQ enqueue, and the
 * per-clinic queue management — lives in services/queuedService.ts.
 */

import { Router } from 'express';
import { asyncHandler } from '../asyncHandler';
import { validateReservationBody } from '../validation';
import * as queuedService from '../services/queuedService';

const router = Router();

router.post(
  '/queued',
  asyncHandler(async (req, res) => {
    // Step 1: Validate
    const validation = validateReservationBody(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.message, code: 'BAD_REQUEST' });
      return;
    }

    // Step 2: Execute strategy (enqueue, do not wait for processing)
    const result = await queuedService.book(validation.data, req.requestId);

    // Step 3: Respond — 202 Accepted (processing is asynchronous)
    if (!result.ok) {
      res.status(result.status).json({ error: result.message, code: result.code });
      return;
    }
    res.status(202).json(result.value);
  }),
);

export default router;
