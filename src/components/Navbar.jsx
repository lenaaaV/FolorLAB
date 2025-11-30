import React from 'react';
import './Navbar.css';

export default function Navbar({ activeTab, onTabChange }) {
    return (
        <nav className="navbar">
            <button
                className={`nav-item ${activeTab === 'map' ? 'active' : ''}`}
                onClick={() => onTabChange('map')}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                    <line x1="8" y1="2" x2="8" y2="18"></line>
                    <line x1="16" y1="6" x2="16" y2="22"></line>
                </svg>
                <span>Karte</span>
            </button>

            <button
                className={`nav-item ${activeTab === 'collection' ? 'active' : ''}`}
                onClick={() => onTabChange('collection')}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <span>Sammlung</span>
            </button>

            <button
                className={`nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`}
                onClick={() => onTabChange('leaderboard')}
            >
                <div className="nav-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                        <path d="M4 22h16"></path>
                        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                    </svg>
                </div>
                <span className="nav-label">Ranking</span>
            </button>

            <button
                className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => onTabChange('profile')}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Profil</span>
            </button>
        </nav>
    );
}
