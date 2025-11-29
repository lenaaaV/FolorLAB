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
                                <div key={challenge.id} className={`challenge-card ${challenge.completed ? 'completed' : ''}`}>
                                    <div className="challenge-icon">
                                        {challenge.completed ? '✅' : '🎯'}
                                    </div>
                                    <div className="challenge-info">
                                        <h4>{challenge.title}</h4>
                                        <p>{challenge.description}</p>
                                    </div>
                                    <div className="challenge-xp">
                                        +{challenge.xp} XP
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="challenges-section">
                        <h3>Wöchentliche Ziele</h3>
                        <div className="challenges-list">
                            {CHALLENGES.filter(c => c.type === 'weekly').map(challenge => (
                                <div key={challenge.id} className={`challenge-card ${challenge.completed ? 'completed' : ''}`}>
                                    <div className="challenge-icon">
                                        {challenge.completed ? '🏆' : '📅'}
                                    </div>
                                    <div className="challenge-info">
                                        <h4>{challenge.title}</h4>
                                        <p>{challenge.description}</p>
                                    </div>
                                    <div className="challenge-xp">
                                        +{challenge.xp} XP
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
