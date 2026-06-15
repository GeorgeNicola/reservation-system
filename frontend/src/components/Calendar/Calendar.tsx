import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
} from 'date-fns';
import './Calendar.css';

interface CalendarProps {
  selected: Date | null;
  onSelect: (date: Date) => void;
}

export default function Calendar({ selected, onSelect }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = startOfDay(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Build array of day cells
  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button className="calendar-nav-btn" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          ‹
        </button>
        <span className="calendar-title">{format(currentMonth, 'MMMM yyyy')}</span>
        <button className="calendar-nav-btn" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          ›
        </button>
      </div>

      <div className="calendar-weekdays">
        {weekdays.map(w => (
          <div key={w} className="calendar-weekday">{w}</div>
        ))}
      </div>

      <div className="calendar-days">
        {days.map((day, i) => {
          const isPast = isBefore(day, today);
          const isOtherMonth = !isSameMonth(day, currentMonth);
          const isSelected = selected && isSameDay(day, selected);
          const isToday = isSameDay(day, today);

          const classes = [
            'calendar-day',
            isPast && 'disabled',
            isOtherMonth && 'other-month',
            isSelected && 'selected',
            isToday && 'today',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={i}
              className={classes}
              onClick={() => !isPast && !isOtherMonth && onSelect(day)}
              disabled={isPast || isOtherMonth}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
