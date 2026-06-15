import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import type { Reservation } from '../types';
import axios from 'axios';

export function useReservations(opts?: { clinicId?: number; patientId?: number }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clinicId = opts?.clinicId;
  const patientId = opts?.patientId;

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, number> = {};
      if (clinicId) params.clinic_id = clinicId;
      if (patientId) params.patient_id = patientId;
      const res = await api.get('/reservations/list', { params });
      setReservations(res.data.reservations);
      setError(null);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to load reservations');
      } else {
        setError('Failed to load reservations');
      }
    } finally {
      setLoading(false);
    }
  }, [clinicId, patientId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReservations();
  }, [fetchReservations]);

  return { reservations, loading, error, refetch: fetchReservations };
}
