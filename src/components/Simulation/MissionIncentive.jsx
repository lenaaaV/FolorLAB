import React, { useState, useEffect } from 'react';
import './MissionOne.css'; // Reuse existing styles

// Simple Modal Component for Badge Reveal
const BadgeModal = ({ item, onClose }) => {
    if (!item) return null;

    return (
        <div className="mission-overlay-container" style={{ zIndex: 2000 }}>
            <div className="mission-card badge-card" style={{ textAlign: 'center' }}>
                <h3 style={{ color: '#FFD700', marginBottom: '10px' }}>🌟 Badge Gefunden!</h3>

                <div style={{ fontSize: '60px', margin: '20px 0' }}>{item.icon || '💎'}</div>

                <h2>{item.name || 'Unknown Treasure'}</h2>
                <p style={{ fontStyle: 'italic', marginBottom: '20px', color: '#666' }}>
                    "{item.desc || 'Ein wertvolles Fundstück.'}"
                </p>

                <div className="xp-badge">+{item.xp || 100} XP</div>

                <button className="primary-button" onClick={onClose} style={{ marginTop: '20px' }}>
                    Weiter
                </button>
            </div>
        </div>
    );
};

const MissionIncentive = ({ onComplete, isAtTarget, distanceToTarget, metrics }) => {
    const [phase, setPhase] = useState('intro'); // intro, active, success
    const [stats, setStats] = useState({ collected: 0, total: 5, xp: 0 });

    // Track Popup State
    const [popupItem, setPopupItem] = useState(null);

    // Listen for new items from Map/App (via metrics prop)
    useEffect(() => {
        if (metrics) {
            setStats({
                collected: metrics.collectedLights || 0,
                total: metrics.totalLights || 5,
                xp: (metrics.collectedLights || 0) * 100
            });

            // Show Popup if a NEW item is reported
            if (metrics.lastItem) {
                setPopupItem(metrics.lastItem);
            }
        }
    }, [metrics]);

    // Handle Arrival
    useEffect(() => {
        if (isAtTarget && phase === 'active' && !popupItem) {
            setPhase('success');
        }
    }, [isAtTarget, phase, popupItem]);

    const handleStart = () => {
        setPhase('active');
    };

    const handleClosePopup = () => {
        setPopupItem(null); // Close modal
    };

    const handleFinish = () => {
        onComplete({
            mission: 'incentive_detour',
            stats: stats,
            success: true
        });
    };

    // --- RENDER ---

    // 1. INTRO
    if (phase === 'intro') {
        return (
            <div className="mission-overlay-container">
                <div className="mission-card intro-card">
                    <div className="mission-header">
                        <span className="mission-icon">🏠</span>
                        <h2>Mission 6: Der Heimweg</h2>
                    </div>

                    <div className="mission-content">
                        <p><strong>Szenario:</strong> Es ist spät. Du möchtest einfach nur nach Hause.</p>
                        <p>Dein Zuhause ist markiert. Der direkte Weg ist kurz.</p>
                        <hr />
                        <p className="hint-text">
                            ✨ <strong>Aber:</strong> In der Gegend wurden seltene
                            <span style={{ color: '#FFD700', fontWeight: 'bold' }}> Sammelobjekte </span>
                            gesichtet.
                        </p>
                        <p>Nimmst du den direkten Weg, oder machst du einen Umweg für die Belohnung?</p>
                    </div>

                    <button className="primary-button" onClick={handleStart}>
                        Mission Starten
                    </button>
                </div>
            </div>
        );
    }

    // 2. ACTIVE HUD (Always visible)
    if (phase === 'active') {
        return (
            <>
                {/* MODAL OVERLAY (High Z-Index) */}
                {popupItem && <BadgeModal item={popupItem} onClose={handleClosePopup} />}

                <div className={`mission-hud-container ${popupItem ? 'blur-bg' : ''}`}>
                    {/* Top Bar */}
                    <div className="hud-stats-bar glass-panel">
                        <div className="stat-item">
                            <span className="label">Ziel:</span>
                            <span className="value">Zuhause 🏠</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="label">Distanz:</span>
                            <span className="value">{Math.round(distanceToTarget || 0)}m</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="label">Fundstücke:</span>
                            <span className="value highlight-gold">
                                {stats.collected} / {stats.total} 💎
                            </span>
                        </div>
                    </div>

                    {/* Bottom Hint */}
                    <div className="hud-hint glass-panel bottom-hint" style={{ bottom: '20px' }}>
                        Suche in den Seitenstraßen nach goldenen Markierungen!
                    </div>
                </div>
            </>
        );
    }

    // 3. SUCCESS / SUMMARY
    if (phase === 'success') {
        const isGreedy = stats.collected >= 3;

        return (
            <div className="mission-overlay-container">
                <div className="mission-card success-card">
                    <div className="mission-header">
                        <span className="mission-icon">🎉</span>
                        <h2>Willkommen Zuhause!</h2>
                    </div>

                    <div className="mission-content">
                        <div className="result-summary">
                            <div className="result-row">
                                <span>Gesammelte Objekte:</span>
                                <span className="result-value">{stats.collected} / {stats.total}</span>
                            </div>
                            <div className="result-row">
                                <span>Total XP:</span>
                                <span className="result-value highlight-xp">+{stats.xp} XP</span>
                            </div>
                        </div>

                        <hr />

                        <p className="analysis-text">
                            {isGreedy
                                ? "Du bist ein Entdecker! Du hast den direkten Weg verlassen, um die Umgebung zu erkunden."
                                : "Du bist fokussiert! Du hast dich nicht ablenken lassen und den schnellsten Weg gewählt."}
                        </p>
                    </div>

                    <button className="primary-button" onClick={handleFinish}>
                        Abschließen
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

export default MissionIncentive;
