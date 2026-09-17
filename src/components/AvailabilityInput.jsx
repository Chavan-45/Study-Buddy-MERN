import React, { useState } from 'react';
import { Clock, Plus, Trash2, AlertCircle } from 'lucide-react';
import TimePicker12Hour from './TimePicker12Hour';
import { formatTime12Hour } from '../utils/timeUtils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function AvailabilityInput({ items = [], onChange }) {
  const [day, setDay] = useState('Monday');
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('19:00');
  const [error, setError] = useState('');

  const handleAdd = () => {
    setError('');

    if (!startTime) {
      setError("Please select a Start Time.");
      return;
    }

    if (!endTime) {
      setError("Please select an End Time.");
      return;
    }

    if (endTime <= startTime) {
      setError("End Time must be after Start Time.");
      return;
    }

    const updated = [...items, { day, startTime, endTime }];
    onChange(updated);
    setStartTime('16:00');
    setEndTime('19:00');
  };

  const handleRemove = (index) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="section-card profile-section-card">
      <div className="section-card-header profile-section-header">
        <div className="section-card-icon">
          <Clock size={22} />
        </div>
        <div>
          <h3>Availability 🕐</h3>
          <p className="section-subtitle">Set your available days and study times.</p>
        </div>
      </div>

      {/* Time Slot Add Row */}
      <div className="availability-add-row profile-availability-form">
        <div className="form-group avail-field-group" style={{ flex: 1, minWidth: '140px' }}>
          <label>Day</label>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="themed-select"
          >
            {DAYS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="form-group avail-field-group profile-time-row" style={{ flex: 2.2, minWidth: '280px' }}>
          <div style={{ flex: 1 }}>
            <label>Start Time</label>
            <TimePicker12Hour
              value={startTime}
              onChange={setStartTime}
              idPrefix="avail-start"
            />
          </div>

          <div style={{ flex: 1 }}>
            <label>End Time</label>
            <TimePicker12Hour
              value={endTime}
              onChange={setEndTime}
              idPrefix="avail-end"
            />
          </div>
        </div>

        <div style={{ paddingBottom: '2px' }}>
          <button
            type="button"
            className="btn-primary profile-add-button"
            onClick={handleAdd}
            style={{ height: '46px', whiteSpace: 'nowrap' }}
          >
            <Plus size={18} />
            <span>Add Slot</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="field-error" style={{ marginTop: '0.5rem' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Saved Slots List */}
      {items.length > 0 ? (
        <div className="profile-slots-stack">
          <span className="profile-sub-label">Saved Availability:</span>
          <div className="availability-grid">
            {items.map((slot, idx) => (
              <div key={idx} className="availability-card-pill profile-availability-item">
                <div className="slot-day">🗓 {slot.day}</div>
                <div className="slot-time">
                  🕐 {formatTime12Hour(slot.startTime)} – {formatTime12Hour(slot.endTime)}
                </div>
                <button
                  type="button"
                  className="btn-remove-pill profile-delete-button"
                  onClick={() => handleRemove(idx)}
                  title="Remove availability slot"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="empty-list-notice">No availability slots added yet. Select a day and time above to add a slot.</p>
      )}
    </div>
  );
}
