import React from 'react';
import './LevelIndicator.css';

export default function LevelIndicator({ level, currentXP, nextLevelXP, progress, style, onClick }) {
    return (
        <div
            className="level-indicator-container"
            style={{ ...style, cursor: onClick ? 'pointer' : 'default' }}
            onClick={onClick}
        >
            <div className="level-badge">
                <span className="level-number">{level}</span>
                <span className="level-label">LVL</span>
            </div>
            <div className="xp-info">
                <div className="xp-text">
                    <span>{currentXP} XP</span>
                    <span className="xp-divider">/</span>
                    <span className="xp-max">{nextLevelXP} XP</span>
                </div>
                <div className="xp-progress-container">
                    <div
                        className="xp-progress-fill"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
}
