import { useMemo } from 'react';
import { format, setHours, setMinutes, isBefore, addMinutes } from 'date-fns';
import type { Reservation } from '../../types';
import './TimeSlots.css';

interface TimeSlotsProps {
  date: Date;
  durationMinutes: number;
  selectedTime: string | null;
  onSelect: (isoString: string) => void;
  existingReservations: Reservation[];
  clinicId: number;
}

export default function TimeSlots({
  date,
  durationMinutes,
  selectedTime,
  onSelect,
  existingReservations,
  clinicId,
}: TimeSlotsProps) {
  const slots = useMemo(() => {
    const result: { time: string; iso: string; disabled: boolean }[] = [];
    const startHour = 8;
    const endHour = 18;
    const now = new Date();

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += durationMinutes) {
        if (h + (m + durationMinutes) / 60 > endHour) continue;

        const slotDate = setMinutes(setHours(date, h), m);
        const slotEnd = addMinutes(slotDate, durationMinutes);
        const iso = slotDate.toISOString();

        // Disable if in the past
        if (isBefore(slotDate, now)) {
          result.push({ time: format(slotDate, 'HH:mm'), iso, disabled: true });
          continue;
        }

        // Check overlap with existing reservations for this clinic
        const isBooked = existingReservations.some(r => {
          if (r.clinic_id !== clinicId) return false;
          if (r.status === 'cancelled') return false;
          const rStart = new Date(r.start_time);
          const rEnd = new Date(r.end_time);
          return slotDate < rEnd && slotEnd > rStart;
        });

        result.push({ time: format(slotDate, 'HH:mm'), iso, disabled: isBooked });
      }
    }
    return result;
  }, [date, durationMinutes, existingReservations, clinicId]);

  return (
    <div>
      <div className="timeslots-title">Available Time Slots</div>
      {slots.length === 0 ? (
        <div className="timeslots-empty">No slots available for this date.</div>
      ) : (
        <div className="timeslots-grid">
          {slots.map(slot => (
            <button
              key={slot.iso}
              className={`timeslot ${slot.disabled ? 'disabled' : ''} ${selectedTime === slot.iso ? 'selected' : ''}`}
              onClick={() => !slot.disabled && onSelect(slot.iso)}
              disabled={slot.disabled}
            >
              {slot.time}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
