import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import type { Service } from '../types';
import axios from 'axios';

export function useServices(clinicId?: number) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const params = clinicId ? { clinic_id: clinicId } : {};
      const res = await api.get('/services', { params });
      setServices(res.data.services);
      setError(null);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to load services');
      } else {
        setError('Failed to load services');
      }
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchServices();
  }, [fetchServices]);

  return { services, loading, error, refetch: fetchServices };
}
