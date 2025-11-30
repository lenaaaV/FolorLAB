import React from 'react';
import './ChallengesModal.css';
import { CHALLENGES } from '../constants';

export default function ChallengesModal({ onClose }) {
    return (
        <div className="challenges-modal-overlay" onClick={onClose}>
            <div className="challenges-modal" onClick={(e) => e.stopPropagation()}>
                <div className="challenges-header">
                    <h2>Deine Challenges</h2>
                    <button className="challenges-close-btn" onClick={onClose}>×</button>
                </div>

                <div className="challenges-content">
                    <div className="challenges-section">
                        <h3>Tägliche Aufgaben</h3>
                        <div className="challenges-list">
                            {CHALLENGES.filter(c => c.type === 'daily').map(challenge => (
                                <div key={challenge.id} className={`challenge-card ${challenge.completed ? 'completed' : ''} ${challenge.type}`}>
                                    <div className="challenge-icon-wrapper">
                                        <div className="challenge-icon">
                                            {challenge.completed ? '✅' : (challenge.icon || '🎯')}
                                        </div>
                                    </div>
                                    <div className="challenge-content-wrapper">
                                        <div className="challenge-header-row">
                                            <h4>{challenge.title}</h4>
                                            <span className="challenge-xp-badge">+{challenge.xp} XP</span>
                                        </div>
                                        <p className="challenge-description">{challenge.description}</p>
                                        <div className="challenge-progress-container">
                                            <div
                                                className="challenge-progress-bar"
                                                style={{ width: challenge.completed ? '100%' : `${(challenge.progress / challenge.target) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="challenge-meta">
                                            <span className="challenge-progress-text">
                                                {challenge.completed ? 'Erledigt!' : `${challenge.progress || 0} / ${challenge.target || 1}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="challenges-section">
                        <h3>Wöchentliche Ziele</h3>
                        <div className="challenges-list">
                            {CHALLENGES.filter(c => c.type === 'weekly').map(challenge => (
                                <div key={challenge.id} className={`challenge-card ${challenge.completed ? 'completed' : ''} ${challenge.type}`}>
                                    <div className="challenge-icon-wrapper">
                                        <div className="challenge-icon">
                                            {challenge.completed ? '🏆' : (challenge.icon || '📅')}
                                        </div>
                                    </div>
                                    <div className="challenge-content-wrapper">
                                        <div className="challenge-header-row">
                                            <h4>{challenge.title}</h4>
                                            <span className="challenge-xp-badge">+{challenge.xp} XP</span>
                                        </div>
                                        <p className="challenge-description">{challenge.description}</p>
                                        <div className="challenge-progress-container">
                                            <div
                                                className="challenge-progress-bar"
                                                style={{ width: challenge.completed ? '100%' : `${(challenge.progress / challenge.target) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="challenge-meta">
                                            <span className="challenge-progress-text">
                                                {challenge.completed ? 'Geschafft!' : `${challenge.progress || 0} / ${challenge.target || 1}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
