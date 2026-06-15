import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import type { Clinic } from '../types';
import axios from 'axios';

export function useClinics() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClinics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/clinics');
      setClinics(res.data.clinics);
      setError(null);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to load clinics');
      } else {
        setError('Failed to load clinics');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchClinics();
  }, [fetchClinics]);

  return { clinics, loading, error, refetch: fetchClinics };
}
