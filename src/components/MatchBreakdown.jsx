import React from 'react';
import { Award } from 'lucide-react';

export default function MatchBreakdown({ breakdown }) {
  if (!breakdown || !breakdown.scores) return null;

  const { scores } = breakdown;

  return (
    <div className="best-match-breakdown-wrapper">
      {/* MATCH BREAKDOWN SCORES TABLE */}
      <div className="scores-breakdown-section">
        <h4 className="section-small-title">
          <Award size={16} /> Match Breakdown
        </h4>
        <div className="scores-breakdown-grid">
          <div className="score-row">
            <span className="score-label">Subject</span>
            <span className="score-value">{scores.subjectMatch} / 35</span>
          </div>
          <div className="score-row">
            <span className="score-label">Skill</span>
            <span className="score-value">{scores.skillLevel} / 20</span>
          </div>
          <div className="score-row">
            <span className="score-label">Availability</span>
            <span className="score-value">{scores.availability} / 20</span>
          </div>
          <div className="score-row">
            <span className="score-label">Mode</span>
            <span className="score-value">{scores.mode} / 15</span>
          </div>
          <div className="score-row">
            <span className="score-label">Location</span>
            <span className="score-value">{scores.location} / 10</span>
          </div>
        </div>
      </div>
    </div>
  );
}
