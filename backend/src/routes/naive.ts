/**
 * routes/naive.ts — HTTP handler for Strategy 1 (no concurrency control).
 *
 * This file contains only HTTP concerns:
 *   1. Validate the request body (delegate to validation.ts)
 *   2. Call the service (delegate to naiveService.ts)
 *   3. Map the Result<T> to an HTTP response
 *
 * All business logic — the overlap check, the INSERT, and the race condition
 * explanation — lives in services/naiveService.ts.
 */

import { Router } from 'express';
import { asyncHandler } from '../asyncHandler';
import { validateReservationBody } from '../validation';
import * as naiveService from '../services/naiveService';

const router = Router();

router.post(
  '/naive',
  asyncHandler(async (req, res) => {
    // Step 1: Validate
    const validation = validateReservationBody(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.message, code: 'BAD_REQUEST' });
      return;
    }

    // Step 2: Execute strategy
    const result = await naiveService.book(validation.data, req.requestId);

    // Step 3: Respond
    if (!result.ok) {
      res.status(result.status).json({ error: result.message, code: result.code });
      return;
    }
    res.status(201).json(result.value);
  }),
);

export default router;
