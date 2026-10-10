import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, getPotentialBuddies } from '../services/userService';
import { findBestMatches } from '../utils/matchingAlgorithm';
import { formatTime12Hour } from '../utils/timeUtils';
import FindBuddyForm from '../components/FindBuddyForm';
import MatchCard from '../components/MatchCard';
import RouletteAnimation from '../components/RouletteAnimation';
import PageHeader from '../components/PageHeader';
import { 
  SearchX, 
  Dices,
  Eye,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';

export default function FindBuddyPage({ currentUser }) {
  const navigate = useNavigate();

  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [isSearching, setIsSearching] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [matches, setMatches] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastCriteria, setLastCriteria] = useState(null);

  useEffect(() => {
    async function loadData() {
      if (!currentUser?.uid) return;
      try {
        setLoadingProfile(true);
        const profile = await getUserProfile(currentUser.uid);

        if (!profile || !profile.profileCompleted) {
          alert("Please complete your student profile before searching for study buddies.");
          navigate('/profile');
          return;
        }

        setUserProfile(profile);
      } catch (err) {
        console.error("Error loading user profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadData();
  }, [currentUser, navigate]);

  const handleSearch = async (criteria) => {
    setIsSearching(true);
    setHasSearched(false);
    setIsSpinning(false);
    setLastCriteria(criteria);

    try {
      const searchCriteria = {
        ...criteria,
        currentUserId: currentUser?.uid,
      };
      const rawCandidates = await getPotentialBuddies(currentUser.uid, searchCriteria);
      const rankedMatches = findBestMatches(searchCriteria, rawCandidates);

      setMatches(rankedMatches);
      setSelectedIndex(0);
      setHasSearched(true);
      
      if (rankedMatches.length > 0) {
        setIsSpinning(true);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleTryAnother = () => {
    if (matches.length <= 1 || isSpinning) return;
    const nextIndex = (selectedIndex + 1) % matches.length;
    setSelectedIndex(nextIndex);
    setIsSpinning(true);
  };

  const handleRouletteComplete = () => {
    setIsSpinning(false);
  };

  if (loadingProfile) {
    return (
      <div className="find-buddy-page">
        <div className="loading-card">
          <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
          <p>Loading your study profile...</p>
        </div>
      </div>
    );
  }

  const currentMatch = matches[selectedIndex];

  return (
    <div className="find-buddy-page">
      <PageHeader
        title="Find Your Study Buddy 🎲"
        description="Select your subject preferences and spin the roulette to find your best match."
        icon={Sparkles}
      />

      {/* Two-Column Desktop Layout */}
      <div className="find-buddy-layout-grid">
        {/* Left Column: Search Form Card */}
        <div className="find-buddy-form-column">
          <FindBuddyForm
            userProfile={userProfile}
            onSearch={handleSearch}
            isSearching={isSearching || isSpinning}
          />
        </div>

        {/* Right Column: Match Results, Roulette Animation, or Initial Placeholder */}
        <div className="find-buddy-results-column">
          {!hasSearched ? (
            <div className="find-buddy-placeholder-card">
              <div className="placeholder-icon-wrap">
                <Dices size={48} style={{ color: '#ea580c' }} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1c1917' }}>Your best match will appear here 🎲</h3>
              <p style={{ color: '#78716c', fontSize: '0.9rem', maxWidth: '320px', lineHeight: 1.5 }}>
                Choose your preferences on the left and click <strong>Find Study Buddy</strong> to start the roulette.
              </p>
            </div>
          ) : isSpinning ? (
            /* ROULETTE ANIMATION EXPERIENCE */
            <RouletteAnimation
              matches={matches}
              targetIndex={selectedIndex}
              onAnimationComplete={handleRouletteComplete}
            />
          ) : (
            /* REVEALED RESULTS */
            <div className="search-results-wrapper animate-reveal">
              {matches.length > 0 && currentMatch ? (
                <div className="results-wrapper">
                  {/* Best Match Result Card */}
                  <MatchCard
                    matchResult={currentMatch}
                    currentUser={currentUser}
                    searchCriteria={lastCriteria}
                    onTryAnother={handleTryAnother}
                    hasMultipleMatches={matches.length > 1}
                  />

                  {/* Other Matches List */}
                  {matches.length > 1 && (
                    <div className="other-matches-card" style={{ marginTop: '1.5rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1c1917', marginBottom: '0.25rem' }}>
                        Other Good Matches 👥
                      </h3>
                      <p className="section-subtitle" style={{ fontSize: '0.85rem', color: '#78716c', marginBottom: '1rem' }}>
                        Other compatible study buddies for your request:
                      </p>

                      <div className="other-matches-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {matches.map((item, idx) => {
                          if (idx === selectedIndex) return null;
                          const cand = item.candidate;
                          const topSkill = Array.isArray(cand.canHelp) && cand.canHelp.length > 0 ? cand.canHelp[0] : null;

                          return (
                            <div
                              key={cand.uid || idx}
                              className="other-match-card"
                              onClick={() => {
                                setSelectedIndex(idx);
                                setIsSpinning(true);
                              }}
                            >
                              <div className="other-match-left">
                                <div className="candidate-avatar sm">
                                  {cand.name ? cand.name.charAt(0).toUpperCase() : 'S'}
                                </div>
                                <div className="other-match-info">
                                  <h4 className="other-match-name">
                                    {cand.name}
                                  </h4>
                                  <span className="other-match-sub">
                                    {cand.department || 'CSE'} • {cand.year || '3rd Year'}
                                  </span>
                                  {topSkill && (
                                    <span className="other-match-skill">
                                      {topSkill.subject} ({topSkill.level || 'Intermediate'})
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="other-match-right">
                                <span className="match-pill-small">
                                  {item.matchScore}% Match
                                </span>
                                <button
                                  type="button"
                                  className="btn-secondary btn-view-other"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedIndex(idx);
                                    setIsSpinning(true);
                                  }}
                                >
                                  <Eye size={13} /> View
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* REDESIGNED NO MATCH STATE CARD */
                <div className="find-buddy-no-results">
                  {/* Centered Circular Icon */}
                  <div className="no-match-icon-circle">
                    <SearchX size={36} className="no-match-icon" />
                  </div>

                  {/* Header & Subtitle */}
                  <h3 className="no-match-title">No suitable Study Buddy found</h3>
                  <p className="no-match-subtitle">
                    We couldn't find a compatible student for your current preferences.
                  </p>

                  {/* Search Preferences Summary Box */}
                  {lastCriteria && (
                    <div className="no-match-summary-card">
                      <span className="no-match-summary-label">Searched Preferences</span>
                      <div className="no-match-summary-tags">
                        <span className="summary-tag">
                          📚 {lastCriteria.subject} • {lastCriteria.requiredLevel || 'Intermediate'}
                        </span>
                        <span className="summary-tag">
                          🗓️ {lastCriteria.day} • {formatTime12Hour(lastCriteria.startTime)} – {formatTime12Hour(lastCriteria.endTime)}
                        </span>
                        <span className="summary-tag">
                          💻📍 {lastCriteria.mode} • {lastCriteria.location}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Suggestions List */}
                  <div className="no-match-suggestions-block">
                    <span className="no-match-suggestions-title">Try these options:</span>
                    <div className="no-match-suggestions-grid">
                      <div className="no-match-suggestion-item">
                        <span className="suggestion-icon">🌐</span>
                        <span className="suggestion-text">Try <strong>Online</strong> study mode</span>
                      </div>
                      <div className="no-match-suggestion-item">
                        <span className="suggestion-icon">🕐</span>
                        <span className="suggestion-text">Adjust your availability</span>
                      </div>
                      <div className="no-match-suggestion-item">
                        <span className="suggestion-icon">📍</span>
                        <span className="suggestion-text">Try another location</span>
                      </div>
                      <div className="no-match-suggestion-item">
                        <span className="suggestion-icon">📚</span>
                        <span className="suggestion-text">Choose another subject</span>
                      </div>
                    </div>
                  </div>

                  {/* Modify Search Action Button */}
                  <div className="no-match-action-wrap">
                    <button
                      type="button"
                      className="btn-primary btn-modify-search"
                      onClick={() => {
                        const el = document.getElementById('find-subject');
                        if (el) {
                          el.focus();
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        } else {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      id="btn-modify-search-preferences"
                    >
                      <SlidersHorizontal size={16} /> Modify Search Preferences
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
