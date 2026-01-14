import React, { useState } from 'react';
import './ProfilingScreen.css';
import { supabase } from '../../supabaseClient';

export default function ProfilingScreen({ onComplete }) {
    const [mood, setMood] = useState(50); // 0 (Stressed) to 100 (Relaxed)
    const [gamingFreq, setGamingFreq] = useState('');
    const [testerId, setTesterId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!gamingFreq || !testerId) {
            setError('Bitte fülle alle Felder aus.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Create Simulation Data JSON
            const profileData = {
                tester_id: testerId,
                mood_score: mood,
                gaming_frequency: gamingFreq,
                device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
                started_at: new Date().toISOString() // Track session start
            };

            // Proceed - Pass data to next step (Calibration)
            onComplete(profileData);
        } catch (err) {
            console.error('Profiling Error:', err);
            // Allow proceed anyway for testing with minimal data
            onComplete({ tester_id: testerId, error: 'Profiling failed', timestamp: new Date().toISOString() });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="profiling-screen-container">
            <div className="profiling-box">
                <h2 className="profiling-title">Profiling Check-In</h2>

                <form onSubmit={handleSubmit}>

                    {/* Question 1: Mood */}
                    <div className="profiling-question">
                        <label className="question-label">1. Wie ist deine aktuelle Stimmung?</label>
                        <div className="mood-slider-container">
                            <span className="mood-label">Gestresst</span>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={mood}
                                onChange={(e) => setMood(parseInt(e.target.value))}
                                className="mood-range"
                            />
                            <span className="mood-label">Entspannt</span>
                        </div>
                        <div className="mood-value-display">Current: {mood}%</div>
                    </div>

                    {/* Question 2: Gaming */}
                    <div className="profiling-question">
                        <label className="question-label">2. Wie oft spielst du Videospiele?</label>
                        <div className="gaming-options">
                            {['Häufig', 'Ab und zu', 'Nie'].map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={`gaming-option-btn ${gamingFreq === option ? 'selected' : ''}`}
                                    onClick={() => setGamingFreq(option)}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tester ID */}
                    <div className="profiling-question">
                        <label className="question-label">Tech-Check: Tester-ID</label>
                        <input
                            type="text"
                            placeholder="z.B. T-01"
                            value={testerId}
                            onChange={(e) => setTesterId(e.target.value)}
                            className="tester-id-input"
                        />
                    </div>

                    {error && <p className="error-message">{error}</p>}

                    <button type="submit" className="submit-profiling-btn" disabled={loading}>
                        {loading ? 'Speichere...' : 'Simulation starten'}
                    </button>
                </form>
            </div>
        </div>
    );
}
