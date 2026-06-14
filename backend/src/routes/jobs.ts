/**
 * routes/jobs.ts — GET /jobs/:id — async job status polling.
 *
 * Clients use this endpoint to poll the status of a queued reservation.
 * The reservation_jobs table is the source of truth; the BullMQ worker
 * updates it as it processes each job.
 *
 * Possible statuses:
 *   pending    — job is waiting in the BullMQ queue
 *   processing — worker has started processing the job
 *   completed  — reservation was created; result_reservation_id is set
 *   failed     — time slot was already taken (conflict detected by worker)
 */

import { Router } from 'express';
import { asyncHandler } from '../asyncHandler';
import { getJobById } from '../db/jobs';

const router = Router();

router.get(
  '/jobs/:id',
  asyncHandler(async (req, res) => {
    const jobId = parseInt(req.params.id, 10);

    if (isNaN(jobId) || jobId <= 0) {
      res.status(400).json({ error: 'Job ID must be a positive integer', code: 'BAD_REQUEST' });
      return;
    }

    const job = await getJobById(jobId);

    if (!job) {
      res.status(404).json({ error: `Job ${jobId} not found`, code: 'NOT_FOUND' });
      return;
    }

    res.json({
      job_id:                job.id,
      status:                job.status,
      clinic_id:             job.clinic_id,
      patient_id:            job.patient_id,
      service_id:            job.service_id,
      start_time:            job.start_time,
      end_time:              job.end_time,
      result_reservation_id: job.result_reservation_id,
      created_at:            job.created_at,
      processed_at:          job.processed_at,
    });
  }),
);

export default router;
