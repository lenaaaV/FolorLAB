import React, { useState } from 'react';
import './MissionOne.css'; // Re-use styling

/**
 * MissionSocial Component
 * 
 * Hypothesis: "Friend-generated content is preferred over anonymous content"
 * 
 * This component tests social proof by measuring which source users trust more:
 * - Anonymous recommendations (with ratings)
 * - Content from friends
 * 
 * Tracks: Which pin/board was clicked first
 */
export default function MissionSocial({ onComplete, isAtTarget, distanceToTarget }) {
    // Component States
    const [status, setStatus] = useState('intro'); // intro | active | success
    const [startTime, setStartTime] = useState(null);
    const [selectedSource, setSelectedSource] = useState(null); // 'friend' or 'anonymous'

    /**
     * Handle Start Button Click
     * Transition from Intro to Active state
     */
    const handleStart = () => {
        setStatus('active');
        setStartTime(Date.now());
    };

    /**
     * Handle Pin Click
     * Record which source was preferred and transition to success
     */
    const handlePinClick = (source) => {
        setSelectedSource(source);
        setStatus('success');
    };

    const handleFinish = () => {
        // Call parent callback with tracking data
        onComplete({
            mission: 'social_proof',
            preferred_source: selectedSource
        });
    }

    // ==================== INTRO STATE ====================
    if (status === 'intro') {
        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{ maxWidth: '500px', textAlign: 'center', padding: '40px' }}>
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>
                        Neue Boards entdeckt! 📍
                    </h2>
                    <p style={{ marginBottom: '30px', lineHeight: '1.6', color: '#555', fontSize: '1.1rem' }}>
                        Zwei neue Memory Boards in deiner Nähe!
                        Geh hin, um sie dir anzusehen.
                    </p>
                    <button
                        className="mission-btn-primary"
                        onClick={handleStart}
                        style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}
                    >
                        Losgehen
                    </button>
                </div>
            </div>
        );
    }

    // ==================== SUCCESS STATE ====================
    if (status === 'success') {
        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>
                        {selectedSource === 'friend' ? '💚' : '⭐'}
                    </div>
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '16px' }}>
                        {selectedSource === 'friend' ? 'Freunde zählen! 👥' : 'Gute Wahl!'}
                    </h2>
                    <p style={{ marginBottom: '20px', fontSize: '1.1rem', color: '#555' }}>
                        {selectedSource === 'friend'
                            ? 'Du vertraust auf die Empfehlung deiner Freundin Lena.'
                            : 'Bewertungen von der Community können sehr hilfreich sein.'}
                    </p>
                    <div style={{
                        background: selectedSource === 'friend'
                            ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                            : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                        padding: '30px',
                        borderRadius: '12px',
                        color: 'white',
                        marginBottom: '20px'
                    }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>
                            {selectedSource === 'friend' ? '👭 Board von Lena' : '🌟 Community Board'}
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
                            {selectedSource === 'friend'
                                ? '"Toller Ort für ein Picknick! Ich war hier letzten Sonntag mit Max. 🌳"'
                                : '"Schöner Park mit vielen Spazierwegen. Sehr empfehlenswert!"'}
                        </p>
                    </div>
                    <button
                        className="mission-btn-primary"
                        onClick={handleFinish}
                        style={{ width: '100%', padding: '15px' }}
                    >
                        Mission abschließen
                    </button>
                </div>
            </div>
        );
    }

    // ==================== ACTIVE & WALKING ====================
    if (status === 'active' && !isAtTarget) {
        return (
            <div className="mission-overlay" style={{ pointerEvents: 'none' }}>
                <div className="mission-card" style={{ textAlign: 'center', padding: '20px', pointerEvents: 'auto' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Suche Boards... 📍</h2>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                        Entfernung zum Ziel: <br />
                        <strong style={{ fontSize: '1.2rem', color: '#333' }}>
                            {distanceToTarget ? Math.round(distanceToTarget) + ' m' : 'Wird berechnet...'}
                        </strong>
                    </p>
                </div>
            </div>
        );
    }

    // ==================== ACTIVE & ARRIVED (Interaction) ====================
    return (
        <div className="mission-overlay">
            <div className="mission-card" style={{ textAlign: 'center', padding: '40px', maxWidth: '700px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '30px' }}>Welches Board möchtest du zuerst sehen?</h2>

                {/* Map Simulation with Two Pins - KEPT STYLING FOR CONSISTENCY */}
                <div style={{
                    background: 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
                    padding: '40px 20px',
                    borderRadius: '16px',
                    marginBottom: '20px',
                    position: 'relative',
                    minHeight: '300px',
                    border: '2px solid #4dd0e1'
                }}>
                    {/* Decorative Map Background */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '6rem',
                        opacity: 0.1,
                        pointerEvents: 'none'
                    }}>
                        🗺️
                    </div>

                    {/* Pin A: Anonymous (Top Left) */}
                    <div
                        onClick={() => handlePinClick('anonymous')}
                        style={{
                            position: 'absolute',
                            top: '60px',
                            left: '80px',
                            background: 'white',
                            padding: '20px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            maxWidth: '200px',
                            border: '2px solid #4facfe'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05) translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 10px 30px rgba(79,172,254,0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1) translateY(0)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
                        }}
                    >
                        <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📌</div>
                        <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: '#2c3e50' }}>
                            Pin A
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#555', margin: '0 0 8px 0' }}>
                            Anonyme Empfehlung
                        </p>
                        <div style={{ fontSize: '0.9rem', color: '#f39c12' }}>
                            ⭐⭐⭐⭐ (4 Sterne)
                        </div>
                    </div>

                    {/* Pin B: Friend (Bottom Right) */}
                    <div
                        onClick={() => handlePinClick('friend')}
                        style={{
                            position: 'absolute',
                            bottom: '60px',
                            right: '80px',
                            background: 'white',
                            padding: '20px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            maxWidth: '200px',
                            border: '2px solid #f5576c'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05) translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 10px 30px rgba(245,87,108,0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1) translateY(0)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
                        }}
                    >
                        <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📍</div>
                        <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: '#2c3e50' }}>
                            Pin B
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#555', margin: '0 0 8px 0', fontWeight: '600' }}>
                            Deine Freundin Lena
                        </p>
                        <div style={{ fontSize: '0.85rem', color: '#888' }}>
                            hat hier ein Board hinterlassen
                        </div>
                    </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '20px' }}>
                    Klicke auf einen Pin, um das Board zu öffnen.
                </p>
            </div>
        </div>
    );
}
