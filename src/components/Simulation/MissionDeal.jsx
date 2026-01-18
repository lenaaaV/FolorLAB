import React, { useState, useEffect } from 'react';
import './MissionOne.css'; // Re-use styling

/**
 * MissionDeal Component
 * 
 * Hypothesis: "Hidden local deals are more attractive than known chains"
 * 
 * This component tests whether users prefer:
 * - Known chain stores with standard pricing
 * - Local businesses with hidden deals (revealed after exploration)
 * 
 * Tracks: Choice made and decision time
 */
export default function MissionDeal({ onComplete, isAtTarget, distanceToTarget }) {
    // Component States
    const [status, setStatus] = useState('intro'); // intro | active | feedback | success
    const [startTime, setStartTime] = useState(null);
    const [choice, setChoice] = useState(null); // 'chain' or 'local'
    const [feedbackText, setFeedbackText] = useState(''); // Justification for 'chain' choice

    /**
     * Handle Start Button Click
     * Transition from Intro to Active state
     */
    const handleStart = () => {
        setStatus('active');
        setStartTime(Date.now());
    };

    /**
     * Handle Choice Selection
     * Record user's choice. If 'chain' (Starbucks), ask for feedback.
     */
    const handleChoice = (selectedChoice) => {
        setChoice(selectedChoice);
        if (selectedChoice === 'chain') {
            setStatus('feedback');
        } else {
            setStatus('success');
        }
    };

    const handleFeedbackSubmit = () => {
        setStatus('success');
    };

    const handleFinish = () => {
        const duration = Date.now() - startTime;
        // Call parent callback with tracking data
        onComplete({
            mission: 'business_deal',
            choice: choice,
            feedback_text: feedbackText, // Save the explanation
            decision_time_ms: duration
        });
    }

    // ==================== INTRO STATE ====================
    if (status === 'intro') {
        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{ maxWidth: '500px', textAlign: 'center', padding: '40px' }}>
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>
                        Hunger! 🍽️
                    </h2>
                    <p style={{ marginBottom: '30px', lineHeight: '1.6', color: '#555', fontSize: '1.1rem' }}>
                        Du hast Hunger. In deiner Nähe gibt es Optionen.
                        Geh hin, um zu sehen, was verfügbar ist!
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

    // ==================== FEEDBACK STATE (Why Corporate?) ====================
    if (status === 'feedback') {
        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{ textAlign: 'center', padding: '40px', maxWidth: '500px' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>Kurze Frage 📝</h2>
                    <p style={{ marginBottom: '25px', color: '#555', lineHeight: '1.5' }}>
                        Du hast dich für <strong>Starbucks</strong> entschieden. <br />
                        Was hat dich davon abgehalten, das lokale Angebot zu wählen?
                    </p>

                    <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="z.B. Ich wollte keine Risiken eingehen..."
                        style={{
                            width: '100%',
                            minHeight: '100px',
                            padding: '15px',
                            borderRadius: '12px',
                            border: '1px solid #ddd',
                            fontSize: '1rem',
                            marginBottom: '20px',
                            fontFamily: 'inherit',
                            resize: 'vertical'
                        }}
                        autoFocus
                    />

                    <button
                        className="mission-btn-primary"
                        onClick={handleFeedbackSubmit}
                        disabled={feedbackText.length < 3} // Force at least some input
                        style={{
                            width: '100%',
                            padding: '15px',
                            opacity: feedbackText.length < 3 ? 0.5 : 1,
                            cursor: feedbackText.length < 3 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Antworten & Fortfahren
                    </button>
                </div>
            </div>
        );
    }

    // ==================== SUCCESS STATE (Result) ====================
    if (status === 'success') {
        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>
                        {choice === 'local' ? '🎉' : '✅'}
                    </div>
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '16px' }}>
                        {choice === 'local' ? 'Lokaler Support! 💚' : 'Gute Wahl!'}
                    </h2>
                    <p style={{ marginBottom: '20px', fontSize: '1.1rem', color: '#555' }}>
                        {choice === 'local'
                            ? 'Du unterstützt lokale Geschäfte und sparst 20%!'
                            : 'Starbucks ist immer eine sichere Option.'}
                    </p>
                    <div style={{
                        background: choice === 'local'
                            ? 'linear-gradient(135deg, #42e695 0%, #3bb2b8 100%)'
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        padding: '20px',
                        borderRadius: '12px',
                        color: 'white',
                        marginBottom: '20px'
                    }}>
                        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
                            {choice === 'local'
                                ? '🥐 Lokaler Bäcker: Frische Backwaren + Hidden Deal aktiviert!'
                                : '☕ Starbucks: Bekannte Qualität zu normalen Preisen'}
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

    // ==================== ACTIVE & WALKING ====================
    if (status === 'active' && !isAtTarget) {
        return (
            <div className="mission-overlay" style={{ pointerEvents: 'none' }}>
                <div className="mission-card" style={{ textAlign: 'center', padding: '20px', pointerEvents: 'auto' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Suche Essen... 🍽️</h2>
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
                <h2 style={{ fontSize: '1.5rem', marginBottom: '30px' }}>Wo möchtest du essen?</h2>

                {/* Two Choice Cards Side-by-Side */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', // Responsive grid
                    gap: '20px',
                    marginBottom: '20px'
                }}>
                    {/* LEFT: Chain Option (Starbucks) */}
                    <div
                        onClick={() => handleChoice('chain')}
                        style={{
                            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                            padding: '30px 20px',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            border: '2px solid #e0e0e0',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                        }}
                    >
                        <div style={{ fontSize: '3rem', marginBottom: '15px' }}>☕</div>
                        <h3 style={{ fontSize: '1.3rem', marginBottom: '10px', color: '#2c3e50' }}>
                            Starbucks
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: '#555', lineHeight: '1.4', margin: 0 }}>
                            Normaler Preis
                        </p>
                        <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '8px' }}>
                            ✓ Bekannt & vertraut
                        </p>
                    </div>

                    {/* RIGHT: Local Option (Hidden Deal) */}
                    <div
                        onClick={() => handleChoice('local')}
                        style={{
                            background: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
                            padding: '30px 20px',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            border: '2px solid #42e695',
                            boxShadow: '0 4px 12px rgba(66,230,149,0.3)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(66,230,149,0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(66,230,149,0.3)';
                        }}
                    >
                        {/* "Hidden Deal" Badge */}
                        <div style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            background: '#ff6b6b',
                            color: 'white',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 8px rgba(255,107,107,0.4)'
                        }}>
                            🔥 DEAL
                        </div>

                        <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🥐</div>
                        <h3 style={{ fontSize: '1.3rem', marginBottom: '10px', color: '#0f3d3e' }}>
                            Lokaler Bäcker
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: '#0f3d3e', fontWeight: '600', lineHeight: '1.4', margin: 0 }}>
                            Hidden Deal: 20% Rabatt
                        </p>
                        <p style={{ fontSize: '0.85rem', color: '#2a5d5e', marginTop: '8px' }}>
                            ✓ Erst nach Entnebeln sichtbar
                        </p>
                    </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '20px' }}>
                    Klicke auf eine Option, um deine Wahl zu treffen.
                </p>
            </div>
        </div>
    );
}
