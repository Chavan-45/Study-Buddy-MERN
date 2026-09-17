import React, { useState } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import TimePicker12Hour from './TimePicker12Hour';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const POPULAR_SUBJECTS = [
  'Machine Learning',
  'Python',
  'Java',
  'Data Structures',
  'Computer Networks',
  'DBMS',
  'Web Development',
  'C++'
];
const LOCATIONS = [
  'College Library',
  'CSE Block',
  'Main Building',
  'Cafeteria',
  'Hostel Study Hall',
  'Other'
];

export default function FindBuddyForm({ userProfile, onSearch, isSearching }) {
  const [subjectMode, setSubjectMode] = useState('select'); // 'select' | 'custom'
  const [selectedSubject, setSelectedSubject] = useState(POPULAR_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [requiredLevel, setRequiredLevel] = useState('Intermediate');
  
  const userFirstSlot = Array.isArray(userProfile?.availability) && userProfile.availability.length > 0
    ? userProfile.availability[0]
    : { day: 'Monday', startTime: '16:00', endTime: '19:00' };

  const [day, setDay] = useState(userFirstSlot.day || 'Monday');
  const [startTime, setStartTime] = useState(userFirstSlot.startTime || '16:00');
  const [endTime, setEndTime] = useState(userFirstSlot.endTime || '19:00');
  
  const [mode, setMode] = useState(userProfile?.mode || 'Both');
  const [location, setLocation] = useState(userProfile?.location || 'College Library');

  const [error, setError] = useState('');

  const handleSubjectSelect = (e) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setSubjectMode('custom');
      setSelectedSubject('');
    } else {
      setSubjectMode('select');
      setSelectedSubject(val);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const finalSubject = subjectMode === 'custom' ? customSubject.trim() : selectedSubject.trim();

    if (!finalSubject) {
      setError("Please select or enter a subject you need help with.");
      return;
    }

    if (!startTime || !endTime) {
      setError("Please select both Start Time and End Time.");
      return;
    }

    if (endTime <= startTime) {
      setError("End Time must be after Start Time.");
      return;
    }

    if ((mode === 'Offline' || mode === 'Both') && !location.trim()) {
      setError("Please select or enter a study location for offline sessions.");
      return;
    }

    onSearch({
      subject: finalSubject,
      requiredLevel,
      day,
      startTime,
      endTime,
      mode,
      location: (mode === 'Online') ? 'Online' : location
    });
  };

  return (
    <div className="find-buddy-form-card">
      <div className="find-buddy-card-title">
        <h3>Search Preferences 🔍</h3>
      </div>

      {error && (
        <div className="alert-banner error" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={18} />
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        {/* ROW 1: Subject */}
        <div className="form-group">
          <label htmlFor="find-subject">Subject You Need Help With 📚</label>
          {subjectMode === 'select' ? (
            <select
              id="find-subject"
              value={selectedSubject}
              onChange={handleSubjectSelect}
              className="themed-select"
            >
              {POPULAR_SUBJECTS.map((subj, idx) => (
                <option key={idx} value={subj}>
                  {subj}
                </option>
              ))}
              <option value="__custom__">✏️ Enter Custom Subject...</option>
            </select>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="e.g. Machine Learning, Web Dev"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="themed-input"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setSubjectMode('select');
                  setSelectedSubject(POPULAR_SUBJECTS[0]);
                }}
                className="btn-secondary"
                style={{ width: 'auto', whiteSpace: 'nowrap', padding: '0 0.85rem' }}
              >
                Select List
              </button>
            </div>
          )}
        </div>

        {/* ROW 2: Target Skill Level */}
        <div className="form-group">
          <label htmlFor="find-level">Target Skill Level Required 🎓</label>
          <select
            id="find-level"
            value={requiredLevel}
            onChange={(e) => setRequiredLevel(e.target.value)}
            className="themed-select"
          >
            {LEVELS.map(lvl => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
        </div>

        {/* PREFERRED DAY (FULL WIDTH ROW) */}
        <div className="form-group find-buddy-day-field">
          <label htmlFor="find-day">Preferred Day 🗓️</label>
          <select
            id="find-day"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="themed-select"
          >
            {DAYS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* START TIME & END TIME (SIDE-BY-SIDE ROW) */}
        <div className="find-buddy-time-row">
          <div className="form-group find-buddy-time-block">
            <label>Start Time 🕐</label>
            <TimePicker12Hour
              value={startTime}
              onChange={setStartTime}
              idPrefix="search-start"
            />
          </div>

          <div className="form-group find-buddy-time-block">
            <label>End Time 🕐</label>
            <TimePicker12Hour
              value={endTime}
              onChange={setEndTime}
              idPrefix="search-end"
            />
          </div>
        </div>

        {/* ROW 4: Study Mode (Dropdown) */}
        <div className="form-group">
          <label htmlFor="find-mode-select">Study Mode 💻📍</label>
          <select
            id="find-mode-select"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="themed-select"
          >
            <option value="Online">Online</option>
            <option value="Offline">Offline</option>
            <option value="Both">Both</option>
          </select>
        </div>

        {/* ROW 5: Preferred Location */}
        <div className="form-group">
          <label htmlFor="find-location">Preferred Study Location 📍</label>
          {mode === 'Online' ? (
            <input
              id="find-location"
              type="text"
              value="Online (Virtual Meeting)"
              disabled
              className="themed-input disabled"
            />
          ) : (
            <select
              id="find-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="themed-select"
            >
              {LOCATIONS.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        <div className="find-buddy-submit-wrapper">
          <button
            type="submit"
            className="btn-primary btn-find-buddy-submit"
            disabled={isSearching}
            id="btn-find-buddy-submit"
          >
            {isSearching ? (
              <>
                <span className="spinner"></span> Finding your best Study Buddy... 🎲
              </>
            ) : (
              <>
                <Sparkles size={18} /> 🎲 Find Study Buddy
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
