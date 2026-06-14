import { Router, Request, Response } from 'express';
import { asyncHandler } from '../asyncHandler';
import { getServices, createService } from '../db/services';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { clinic_id } = req.query;

    if (clinic_id && isNaN(Number(clinic_id))) {
      res.status(400).json({ error: 'clinic_id must be a number' });
      return;
    }

    const services = await getServices(clinic_id ? Number(clinic_id) : undefined);
    
    res.json({
      count: services.length,
      services
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { clinic_id, name, duration_minutes, description, price } = req.body;

    if (!clinic_id || !name || !duration_minutes) {
      res.status(400).json({ error: 'Missing required fields: clinic_id, name, duration_minutes' });
      return;
    }

    if (isNaN(Number(clinic_id)) || isNaN(Number(duration_minutes))) {
      res.status(400).json({ error: 'clinic_id and duration_minutes must be numbers' });
      return;
    }

    const newService = await createService(
      Number(clinic_id),
      name,
      Number(duration_minutes),
      description,
      price ? Number(price) : undefined
    );

    res.status(201).json({
      message: 'Service created successfully',
      service: newService
    });
  })
);

export default router;
