import { useContext } from 'react';
import { ToastContext } from './ToastContext';
import type { ToastContextType } from './ToastContext';

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
