import React, { useState } from 'react';
import { Plus, Trash2, GraduationCap, AlertCircle } from 'lucide-react';

export default function SkillInput({
  title,
  subtitle,
  icon: Icon = GraduationCap,
  items = [],
  onChange,
  addLabel = "+ Add Skill",
  subjectPlaceholder = "Subject / Skill Name (e.g. Python, Java)"
}) {
  const [newSubject, setNewSubject] = useState('');
  const [newLevel, setNewLevel] = useState('Intermediate');
  const [error, setError] = useState('');

  const handleAdd = () => {
    setError('');
    const trimmed = newSubject.trim();

    if (!trimmed) {
      setError("Please enter a subject or skill name.");
      return;
    }

    const isDuplicate = items.some(
      item => item.subject.toLowerCase() === trimmed.toLowerCase()
    );

    if (isDuplicate) {
      setError(`"${trimmed}" is already added to this list.`);
      return;
    }

    const updated = [...items, { subject: trimmed, level: newLevel }];
    onChange(updated);
    setNewSubject('');
    setNewLevel('Intermediate');
  };

  const handleRemove = (index) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleLevelChange = (index, newLvl) => {
    const updated = items.map((item, i) => {
      if (i === index) return { ...item, level: newLvl };
      return item;
    });
    onChange(updated);
  };

  return (
    <div className="section-card profile-section-card">
      <div className="section-card-header profile-section-header">
        <div className="section-card-icon">
          <Icon size={22} />
        </div>
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="section-subtitle">{subtitle}</p>}
        </div>
      </div>

      {/* Input controls row: Subject Input | Level Select | Add Button */}
      <div className="skill-add-row profile-skill-form">
        <div className="skill-input-box" style={{ flex: 2 }}>
          <input
            type="text"
            placeholder={subjectPlaceholder}
            value={newSubject}
            onChange={(e) => {
              setNewSubject(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="themed-input"
          />
        </div>

        <select
          value={newLevel}
          onChange={(e) => setNewLevel(e.target.value)}
          className="level-select themed-select"
          style={{ flex: 1, minWidth: '130px' }}
        >
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
        </select>

        <button
          type="button"
          className="btn-primary profile-add-button"
          onClick={handleAdd}
          style={{ height: '46px', whiteSpace: 'nowrap' }}
        >
          <Plus size={18} />
          <span>{addLabel}</span>
        </button>
      </div>

      {error && (
        <div className="field-error" style={{ marginTop: '0.5rem' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Saved Skills List */}
      {items.length > 0 ? (
        <div className="profile-skills-stack">
          <span className="profile-sub-label">Your Saved Skills:</span>
          <div className="skills-badge-grid">
            {items.map((item, idx) => (
              <div key={idx} className="skill-pill profile-skill-item">
                <span className="skill-name">{item.subject}</span>
                <select
                  value={item.level}
                  onChange={(e) => handleLevelChange(idx, e.target.value)}
                  className="pill-level-select profile-skill-level"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
                <button
                  type="button"
                  className="btn-remove-pill profile-delete-button"
                  onClick={() => handleRemove(idx)}
                  title="Remove skill"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="empty-list-notice">No skills added yet. Use the form above to add your first entry.</p>
      )}
    </div>
  );
}
