import React, { useState, useEffect } from 'react';
import './MissionOne.css'; // Re-use styling

/**
 * MissionSecret Component
 * 
 * Hypothesis: "Exklusivität steigert das Interesse (Curiosity Gap)"
 * 
 * This component tests whether exclusivity increases user interest by:
 * - Presenting a blurred preview of exclusive content
 * - Tracking user engagement (clicks on blurred image)
 * - Measuring time spent before unlocking the content
 */
export default function MissionSecret({ onComplete, isAtTarget, distanceToTarget }) {
    // Component States
    const [status, setStatus] = useState('intro'); // intro | active | success
    const [startTime, setStartTime] = useState(null);
    const [interestClicks, setInterestClicks] = useState(0); // Track interest clicks on blurred content

    /**
     * Handle Start Button Click
     * Transition from Intro to Active state
     */
    const handleStart = () => {
        setStatus('active');
        setStartTime(Date.now());
    };

    /**
     * Handle Blurred Image Click
     * Increment the curiosity click counter
     */
    const handleBlurClick = () => {
        if (status === 'active') {
            setInterestClicks(prev => prev + 1);
        }
    };

    // Auto-trigger Success when arrived
    useEffect(() => {
        if (status === 'active' && isAtTarget) {
            handleSuccessTransition(); // Just switch UI, don't finish mission yet
        }
    }, [isAtTarget, status]);

    const handleSuccessTransition = () => {
        setStatus('success');
    }

    /**
     * Handle Final Completion
     */
    const handleFinish = () => {
        const duration = Date.now() - startTime;

        // Call parent callback with tracking data
        onComplete({
            mission: 'secret_board',
            interest_clicks: interestClicks,
            walk_duration: duration,
            real_walk: true
        });
    };

    // ==================== INTRO STATE ====================
    if (status === 'intro') {
        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{ maxWidth: '500px', textAlign: 'center', padding: '40px' }}>
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>
                        Geheimnis entdeckt! 🤫
                    </h2>
                    <p style={{ marginBottom: '20px', lineHeight: '1.6', color: '#555', fontSize: '1.1rem' }}>
                        Ein exklusiver Tipp ist ganz in der Nähe (~200m).
                        Du musst näher ran, um ihn zu sehen!
                    </p>
                    <div style={{
                        background: '#f8f9fa',
                        padding: '20px',
                        borderRadius: '8px',
                        marginBottom: '30px',
                        border: '1px solid #e9ecef'
                    }}>
                        <p style={{ margin: 0, fontSize: '0.95rem', color: '#666' }}>
                            💡 <strong>Hinweis:</strong> Der Inhalt ist verschwommen, bis du nah genug bist.
                        </p>
                    </div>
                    <button
                        className="mission-btn-primary"
                        onClick={handleStart}
                        style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}
                    >
                        Suche starten
                    </button>
                </div>
            </div>
        );
    }

    // ==================== SUCCESS STATE (Arrived) ====================
    if (status === 'success') {
        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎉</div>
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '16px' }}>Geheimnis enthüllt!</h2>
                    <p style={{ marginBottom: '20px', fontSize: '1.1rem', color: '#555' }}>
                        Du hast den exklusiven Inhalt freigeschaltet!
                    </p>
                    <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        padding: '30px',
                        borderRadius: '12px',
                        color: 'white',
                        marginBottom: '20px'
                    }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>☕ Geheimtipp</h3>
                        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
                            Geheimtipp: 2-für-1 Kaffee bei 'Café Luis'!
                        </p>
                    </div>
                    <button
                        className="mission-btn-primary"
                        onClick={handleFinish}
                        style={{ width: '100%', padding: '15px' }}
                    >
                        Weiter zur nächsten Mission
                    </button>
                </div>
            </div>
        );
    }

    // ==================== ACTIVE STATE (Walking) ====================
    return (
        <div className="mission-overlay" style={{ pointerEvents: 'none' }}> {/* Allow clicking through to map */}
            <div className="mission-card" style={{ textAlign: 'center', padding: '20px', pointerEvents: 'auto', maxWidth: '400px' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Suche das Geheimnis 📍</h2>

                {/* Blurred Preview Image */}
                <div
                    onClick={handleBlurClick}
                    style={{
                        position: 'relative',
                        marginBottom: '15px',
                        cursor: 'pointer',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            height: '120px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            filter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem'
                        }}
                    >
                        🌟✨
                    </div>
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '5px 15px',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        pointerEvents: 'none'
                    }}>
                        🔒 Verschwommen
                    </div>
                </div>

                <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                        Entfernung zum Ziel: <br />
                        <strong style={{ fontSize: '1.2rem', color: '#333' }}>
                            {distanceToTarget ? Math.round(distanceToTarget) + ' m' : 'Wird berechnet...'}
                        </strong>
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#999', marginTop: '5px' }}>
                        (Klicke auf die Karte, um dich zu bewegen)
                    </p>
                </div>
            </div>
        </div>
    );
}
