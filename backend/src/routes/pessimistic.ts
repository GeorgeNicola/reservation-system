/**
 * routes/pessimistic.ts — HTTP handler for Strategy 2 (pessimistic locking).
 *
 * This file contains only HTTP concerns:
 *   1. Validate the request body (delegate to validation.ts)
 *   2. Call the service (delegate to pessimisticService.ts)
 *   3. Map the Result<T> to an HTTP response
 *
 * All business logic — the advisory lock, the transaction, the overlap check,
 * and the serialization guarantee — lives in services/pessimisticService.ts.
 */

import { Router } from 'express';
import { asyncHandler } from '../asyncHandler';
import { validateReservationBody } from '../validation';
import * as pessimisticService from '../services/pessimisticService';

const router = Router();

router.post(
  '/pessimistic',
  asyncHandler(async (req, res) => {
    // Step 1: Validate
    const validation = validateReservationBody(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.message, code: 'BAD_REQUEST' });
      return;
    }

    // Step 2: Execute strategy
    const result = await pessimisticService.book(validation.data, req.requestId);

    // Step 3: Respond
    if (!result.ok) {
      res.status(result.status).json({ error: result.message, code: result.code });
      return;
    }
    res.status(201).json(result.value);
  }),
);

export default router;
