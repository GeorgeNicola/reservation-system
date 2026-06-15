/* ── Shared frontend types matching backend models ─────────────────── */

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'patient' | 'doctor';
}

export interface Clinic {
  id: number;
  doctor_id: number;
  name: string;
  specialty: string;
  is_active: boolean;
  created_at: string;
}

export interface Service {
  id: number;
  clinic_id: number;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Reservation {
  id: number;
  clinic_id: number;
  patient_id: number;
  service_id: number;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  processed_by_instance: string | null;
  created_at: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface ReservationResponse {
  reservation_id: number;
  clinic_id: number;
  patient_id: number;
  start_time: string;
  end_time: string;
  processed_by_instance: string | null;
  strategy: string;
}
