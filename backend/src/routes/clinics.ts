import { Router, Request, Response } from 'express';
import { asyncHandler } from '../asyncHandler';
import { getClinics, createClinic } from '../db/clinics';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const clinics = await getClinics();
    res.json({
      count: clinics.length,
      clinics
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { doctor_id, name, specialty } = req.body;

    if (!doctor_id || !name || !specialty) {
      res.status(400).json({ error: 'Missing required fields: doctor_id, name, specialty' });
      return;
    }

    try {
      const newClinic = await createClinic(Number(doctor_id), name, specialty);
      res.status(201).json({
        message: 'Clinic created successfully',
        clinic: newClinic
      });
    } catch (error: any) {
      // Handle unique constraint violation for doctor_id
      if (error.code === '23505') {
        res.status(409).json({ error: 'Doctor already has a clinic assigned' });
        return;
      }
      throw error; // Let global error handler deal with other errors
    }
  })
);

export default router;
