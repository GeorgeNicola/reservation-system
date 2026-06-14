import { Router, Request, Response } from 'express';
import { asyncHandler } from '../asyncHandler';
import { getReservations } from '../db/reservations';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { clinic_id, patient_id } = req.query;

    const clinicId = clinic_id ? Number(clinic_id) : undefined;
    const patientId = patient_id ? Number(patient_id) : undefined;

    if (clinic_id && isNaN(clinicId!)) {
      res.status(400).json({ error: 'clinic_id must be a number' });
      return;
    }

    if (patient_id && isNaN(patientId!)) {
      res.status(400).json({ error: 'patient_id must be a number' });
      return;
    }

    const reservations = await getReservations(clinicId, patientId);

    res.json({
      count: reservations.length,
      reservations
    });
  })
);

export default router;
