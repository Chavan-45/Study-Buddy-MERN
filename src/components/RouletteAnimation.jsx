import React, { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';

export default function RouletteAnimation({
  matches,
  targetIndex = 0,
  onAnimationComplete
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [statusText, setStatusText] = useState('Analyzing compatibility...');
  const [animKey, setAnimKey] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!matches || matches.length === 0) return;

    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || matches.length === 1) {
      const singleTimer = setTimeout(() => {
        setStatusText('🎉 Match Found!');
        setTimeout(() => {
          onAnimationComplete();
        }, 400);
      }, 1000);
      return () => clearTimeout(singleTimer);
    }

    let step = 0;
    const totalSteps = 14 + (targetIndex % matches.length);
    let currentDelay = 110;

    const runNextStep = () => {
      if (step >= totalSteps) {
        setCurrentIndex(targetIndex);
        setAnimKey(prev => prev + 1);
        setStatusText('🎉 Match Found!');
        timerRef.current = setTimeout(() => {
          onAnimationComplete();
        }, 450);
        return;
      }

      step++;
      setCurrentIndex((prev) => (prev + 1) % matches.length);
      setAnimKey(prev => prev + 1);

      if (step < 6) {
        currentDelay = 110;
        setStatusText('Analyzing compatibility...');
      } else if (step < 11) {
        currentDelay = 230;
        setStatusText('Almost there...');
      } else {
        currentDelay = 420;
        setStatusText('Finding your perfect match...');
      }

      timerRef.current = setTimeout(runNextStep, currentDelay);
    };

    timerRef.current = setTimeout(runNextStep, currentDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [matches, targetIndex, onAnimationComplete]);

  const activeCandidate = matches[currentIndex]?.candidate;
  const activeScore = matches[currentIndex]?.matchScore;
  const matchedSkill = matches[currentIndex]?.breakdown?.matchedSkill?.subject || activeCandidate?.canHelp?.[0]?.subject || 'Study Subject';
  const matchedLevel = matches[currentIndex]?.breakdown?.matchedSkill?.level || activeCandidate?.canHelp?.[0]?.level || 'Intermediate';

  return (
    <div className="roulette-card">
      {/* ROULETTE HEADER */}
      <div className="roulette-header">
        <h3 className="roulette-title">🎲 STUDY BUDDY ROULETTE</h3>
        <p className="roulette-subtitle">Finding your perfect match...</p>
        <div className="roulette-progress-track">
          <div className="roulette-progress-bar"></div>
        </div>
      </div>

      {/* CANDIDATE ANIMATION CONTAINER */}
      {activeCandidate && (
        <div key={animKey} className="roulette-candidate-wrapper">
          {/* ANIMATED AVATAR RING */}
          <div className="roulette-avatar-ring-container">
            <div className="roulette-avatar-ring"></div>
            <div className="roulette-avatar">
              {activeCandidate.name ? activeCandidate.name.charAt(0).toUpperCase() : 'S'}
            </div>
          </div>

          {/* CANDIDATE DETAILS */}
          <h4 className="roulette-name">{activeCandidate.name}</h4>
          <span className="roulette-dept">
            {activeCandidate.department || 'CSE'} • {activeCandidate.year || '3rd Year'}
          </span>

          {/* SKILL CHIP */}
          <div className="roulette-skill-chip-wrap">
            <span className="roulette-skill-chip">
              <Sparkles size={13} /> {matchedSkill} • <strong>{matchedLevel}</strong>
            </span>
          </div>

          {/* MATCH PERCENTAGE BADGE */}
          <div className="roulette-match-badge">
            {activeScore}% Match
          </div>
        </div>
      )}

      {/* STATUS / PROGRESS TEXT */}
      <div className="roulette-status">
        <span>{statusText}</span>
      </div>
    </div>
  );
}
