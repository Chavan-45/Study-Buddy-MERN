import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, updateUserProfile } from '../services/userService';
import SkillInput from '../components/SkillInput';
import AvailabilityInput from '../components/AvailabilityInput';
import PageHeader from '../components/PageHeader';
import { 
  User, 
  Mail, 
  Phone, 
  GraduationCap, 
  MapPin, 
  Save, 
  AlertCircle, 
  CheckCircle2,
  Star,
  Shield
} from 'lucide-react';

const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'IT', 'Civil', 'Mechanical', 'Other'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const LOCATIONS = [
  'College Library',
  'CSE Block',
  'Main Building',
  'Cafeteria',
  'Hostel Study Hall',
  'Other'
];

export default function ProfilePage({ currentUser }) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    sharePhoneAfterAcceptance: false,
    department: 'CSE',
    year: '1st Year',
    bio: '',
    canHelp: [],
    availability: [],
    mode: 'Both',
    locationSelect: 'College Library',
    customLocation: '',
    averageRating: null,
    ratingCount: 0
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalAlert, setGlobalAlert] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      if (!currentUser?.uid) return;
      try {
        setLoading(true);
        const data = await getUserProfile(currentUser.uid);

        let locSel = 'College Library';
        let custLoc = '';
        if (data?.location) {
          if (LOCATIONS.includes(data.location)) {
            locSel = data.location;
          } else {
            locSel = 'Other';
            custLoc = data.location;
          }
        }

        setFormData({
          name: data?.name || currentUser.displayName || '',
          email: currentUser.email || '',
          phone: data?.phone || '',
          sharePhoneAfterAcceptance: Boolean(data?.sharePhoneAfterAcceptance),
          department: data?.department || 'CSE',
          year: data?.year || '1st Year',
          bio: data?.bio || '',
          canHelp: Array.isArray(data?.canHelp) ? data.canHelp : [],
          availability: Array.isArray(data?.availability) ? data.availability : [],
          mode: data?.mode || 'Both',
          locationSelect: locSel,
          customLocation: custLoc,
          averageRating: data?.averageRating || null,
          ratingCount: data?.ratingCount || 0
        });
      } catch (err) {
        console.error("Error loading profile:", err);
        setGlobalAlert({ type: 'error', text: "Failed to load profile data." });
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name cannot be empty.";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required.";
    }

    if (!formData.department) {
      newErrors.department = "Please select a department.";
    }

    if (!formData.year) {
      newErrors.year = "Please select your year of study.";
    }

    if (formData.bio.length > 200) {
      newErrors.bio = "Bio cannot exceed 200 characters.";
    }

    if (formData.mode !== 'Online') {
      if (formData.locationSelect === 'Other' && !formData.customLocation.trim()) {
        newErrors.location = "Please enter your custom study location.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;

    setGlobalAlert(null);

    if (!validateForm()) {
      setGlobalAlert({ type: 'error', text: "Please fix the highlighted errors before saving." });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);

    try {
      const finalLocation = formData.locationSelect === 'Other'
        ? formData.customLocation.trim()
        : formData.locationSelect;

      const profilePayload = {
        name: formData.name.trim(),
        email: formData.email,
        phone: formData.phone.trim(),
        sharePhoneAfterAcceptance: Boolean(formData.sharePhoneAfterAcceptance),
        department: formData.department,
        year: formData.year,
        bio: formData.bio.trim(),
        canHelp: formData.canHelp,
        availability: formData.availability,
        mode: formData.mode,
        location: finalLocation
      };

      await updateUserProfile(currentUser.uid, profilePayload);

      setGlobalAlert({ type: 'success', text: "Profile saved successfully!" });
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 700);
    } catch (err) {
      console.error("Save profile error:", err);
      setGlobalAlert({ type: 'error', text: err.message || "Failed to save profile." });
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-card">
          <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
          <p>Loading your profile details...</p>
        </div>
      </div>
    );
  }

  const ratingBadge = (
    <div className="profile-rating-badge" style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '0.45rem 0.9rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
      <Star size={20} fill="#f59e0b" color="#f59e0b" />
      <div>
        <span style={{ fontSize: '0.68rem', color: '#78716c', display: 'block', textTransform: 'uppercase', fontWeight: '800' }}>Received Rating</span>
        {formData.ratingCount > 0 ? (
          <strong style={{ fontSize: '0.95rem', color: '#b45309' }}>
            {Number(formData.averageRating).toFixed(1)} <span style={{ fontSize: '0.78rem', color: '#78716c', fontWeight: '500' }}>({formData.ratingCount} {formData.ratingCount === 1 ? 'rating' : 'ratings'})</span>
          </strong>
        ) : (
          <span style={{ fontSize: '0.82rem', color: '#78716c', fontWeight: '600' }}>No ratings yet</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="profile-container">
      <PageHeader
        title="Student Profile 🎓"
        description="Manage your profile, academic skills, availability, and study preferences."
        icon={User}
        action={ratingBadge}
      />

      {globalAlert && (
        <div className={`alert-banner ${globalAlert.type}`} style={{ marginBottom: '1.5rem' }}>
          {globalAlert.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <div>{globalAlert.text}</div>
        </div>
      )}

      <form onSubmit={handleSave} className="profile-form">
        {/* BASIC INFORMATION */}
        <div className="section-card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
          <div className="section-card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem', borderBottom: '1px solid #f3e8df', paddingBottom: '0.85rem' }}>
            <div className="section-card-icon" style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1c1917' }}>Basic Information</h3>
              <p className="section-subtitle" style={{ fontSize: '0.84rem', color: '#78716c' }}>Your personal contact and academic identity.</p>
            </div>
          </div>

          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.15rem' }}>
            <div className="form-group">
              <label htmlFor="prof-name">Full Name</label>
              <div className={`input-wrapper ${errors.name ? 'has-error' : ''}`}>
                <User className="input-icon" size={18} />
                <input
                  id="prof-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Rahul Kumar"
                  className="themed-input"
                />
              </div>
              {errors.name && <span className="field-error"><AlertCircle size={14} /> {errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="prof-email">Email (Read-only)</label>
              <div className="input-wrapper disabled">
                <Mail className="input-icon" size={18} />
                <input
                  id="prof-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  readOnly
                  disabled
                  className="themed-input disabled"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="prof-phone">Phone Number</label>
              <div className={`input-wrapper ${errors.phone ? 'has-error' : ''}`}>
                <Phone className="input-icon" size={18} />
                <input
                  id="prof-phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="9876543210"
                  className="themed-input"
                />
              </div>
              {errors.phone && <span className="field-error"><AlertCircle size={14} /> {errors.phone}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="prof-dept">Department</label>
              <select
                id="prof-dept"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="themed-select"
              >
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="prof-year">Year of Study</label>
              <select
                id="prof-year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                className="themed-select"
              >
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* PRIVACY OPTION FOR PHONE NUMBER */}
          <div className="form-group" style={{ marginTop: '1.25rem', background: '#fafaf9', padding: '0.85rem 1rem', borderRadius: '0.85rem', border: '1px solid #f3e8df' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontSize: '0.88rem', color: '#1c1917', fontWeight: 600 }}>
              <input
                type="checkbox"
                name="sharePhoneAfterAcceptance"
                checked={formData.sharePhoneAfterAcceptance}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#ea580c' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Shield size={16} style={{ color: '#ea580c' }} /> Share my phone number with buddy after request acceptance
              </span>
            </label>
            <span style={{ fontSize: '0.78rem', color: '#78716c', marginLeft: '1.85rem', display: 'block', marginTop: '0.25rem' }}>
              If unchecked, your phone number remains hidden even after a session is accepted.
            </span>
          </div>

          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="prof-bio">Short Bio</label>
              <span style={{ fontSize: '0.75rem', color: formData.bio.length > 200 ? 'var(--error)' : 'var(--text-dim)' }}>
                {formData.bio.length} / 200 chars
              </span>
            </div>
            <textarea
              id="prof-bio"
              name="bio"
              rows={3}
              placeholder="Interested in coding, web development and helping other students."
              value={formData.bio}
              onChange={handleChange}
              maxLength={200}
              className={`themed-input ${errors.bio ? 'has-error' : ''}`}
              style={{ height: 'auto', padding: '0.75rem 1rem' }}
            ></textarea>
            {errors.bio && <span className="field-error"><AlertCircle size={14} /> {errors.bio}</span>}
          </div>
        </div>

        {/* CAN HELP SKILLS */}
        <div style={{ marginBottom: '1.5rem' }}>
          <SkillInput
            title="I Can Help With 🎓"
            subtitle="Subjects or skills you are comfortable tutoring or helping peers with."
            icon={GraduationCap}
            items={formData.canHelp}
            onChange={(newSkills) => setFormData(prev => ({ ...prev, canHelp: newSkills }))}
            addLabel="+ Add Skill"
            subjectPlaceholder="Subject / Skill Name (e.g. Python, Java)"
          />
        </div>

        {/* AVAILABILITY */}
        <div style={{ marginBottom: '1.5rem' }}>
          <AvailabilityInput
            items={formData.availability}
            onChange={(newSlots) => setFormData(prev => ({ ...prev, availability: newSlots }))}
          />
        </div>

        {/* STUDY MODE & LOCATION */}
        <div className="section-card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
          <div className="section-card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem', borderBottom: '1px solid #f3e8df', paddingBottom: '0.85rem' }}>
            <div className="section-card-icon" style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1c1917' }}>Preferred Mode &amp; Location</h3>
              <p className="section-subtitle" style={{ fontSize: '0.84rem', color: '#78716c' }}>How and where you prefer to conduct study sessions.</p>
            </div>
          </div>

          <div className="form-group">
            <label>Preferred Study Mode</label>
            <div className="mode-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem' }}>
              {['Online', 'Offline', 'Both'].map((m) => (
                <div
                  key={m}
                  className={`mode-card ${formData.mode === m ? 'selected' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, mode: m }))}
                  style={{
                    background: formData.mode === m ? '#fff7ed' : '#ffffff',
                    border: formData.mode === m ? '2px solid #ea580c' : '1px solid #e7e5e4',
                    borderRadius: '0.85rem',
                    padding: '0.85rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    fontWeight: 700,
                    color: formData.mode === m ? '#ea580c' : '#1c1917',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={m}
                    checked={formData.mode === m}
                    onChange={() => {}}
                    style={{ accentColor: '#ea580c' }}
                  />
                  <span>{m}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <label htmlFor="prof-location">Preferred Study Location 📍</label>
            <select
              id="prof-location"
              name="locationSelect"
              value={formData.locationSelect}
              onChange={handleChange}
              className="themed-select"
            >
              {LOCATIONS.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {formData.locationSelect === 'Other' && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="custom-loc">Custom Location Name</label>
              <input
                id="custom-loc"
                type="text"
                name="customLocation"
                placeholder="e.g. Innovation Hub Room 204"
                value={formData.customLocation}
                onChange={handleChange}
                className={`themed-input ${errors.location ? 'has-error' : ''}`}
              />
              {errors.location && <span className="field-error"><AlertCircle size={14} /> {errors.location}</span>}
            </div>
          )}
        </div>

        {/* SAVE BUTTON */}
        <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ padding: '0 2rem', height: '48px', fontSize: '1rem' }}
            id="btn-save-profile"
          >
            {saving ? (
              <>
                <span className="spinner"></span> Saving Profile...
              </>
            ) : (
              <>
                <Save size={20} /> Save Profile
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
