import React, { useEffect, useState } from 'react';
import { convert12To24, convert24To12Parts } from '../utils/timeUtils';
import { Clock } from 'lucide-react';

const HOURS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const MINUTES = ['00', '15', '30', '45'];
const PERIODS = ['AM', 'PM'];

export default function TimePicker12Hour({ value, onChange, idPrefix = 'time' }) {
  const parts = convert24To12Parts(value);
  const [hour, setHour] = useState(parts.hour);
  const [minute, setMinute] = useState(parts.minute);
  const [period, setPeriod] = useState(parts.period);

  useEffect(() => {
    const currentParts = convert24To12Parts(value);
    setHour(currentParts.hour);
    setMinute(currentParts.minute);
    setPeriod(currentParts.period);
  }, [value]);

  const updateTime = (h, m, p) => {
    setHour(h);
    setMinute(m);
    setPeriod(p);
    const new24 = convert12To24(h, m, p);
    if (onChange) {
      onChange(new24);
    }
  };

  return (
    <div className="find-buddy-time-control">
      <Clock size={15} className="find-buddy-time-icon" />

      {/* HOUR SELECTOR */}
      <select
        id={`${idPrefix}-hour`}
        aria-label="Hour"
        value={hour}
        onChange={(e) => updateTime(e.target.value, minute, period)}
        className="find-buddy-time-select find-buddy-time-hour"
      >
        {HOURS.map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>

      <span className="find-buddy-time-separator">:</span>

      {/* MINUTE SELECTOR */}
      <select
        id={`${idPrefix}-minute`}
        aria-label="Minute"
        value={minute}
        onChange={(e) => updateTime(hour, e.target.value, period)}
        className="find-buddy-time-select find-buddy-time-minute"
      >
        {MINUTES.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <span className="find-buddy-time-divider">|</span>

      {/* AM / PM SELECTOR */}
      <select
        id={`${idPrefix}-period`}
        aria-label="AM PM Period"
        value={period}
        onChange={(e) => updateTime(hour, minute, e.target.value)}
        className="find-buddy-time-select find-buddy-time-period"
      >
        {PERIODS.map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
  );
}
