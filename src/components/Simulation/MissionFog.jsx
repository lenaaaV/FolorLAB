import React, { useState, useEffect } from 'react';
import './MissionOne.css'; // Re-use styling

export default function MissionFog({ onComplete, isAtTarget, distanceToTarget, metrics }) {
    const [group, setGroup] = useState(null); // 'A' (Clear) or 'B' (Fog)
    const [status, setStatus] = useState('intro'); // intro | active | success
    const [startTime, setStartTime] = useState(null);
    const [distance, setDistance] = useState(0);
    const [rating, setRating] = useState(null);
    const [fogInfluence, setFogInfluence] = useState(null);
    const [fogMotivation, setFogMotivation] = useState('');

    // Initial Random Assignment
    useEffect(() => {
        // Simple A/B Split
        const assignedGroup = Math.random() > 0.5 ? 'A' : 'B';
        setGroup(assignedGroup);
    }, []);

    // Handle Arrival from Prop
    useEffect(() => {
        if (isAtTarget && status === 'active') {
            handleSuccess('arrival');
        }
    }, [isAtTarget, status]);

    const handleStart = () => {
        setStatus('active');
        setStartTime(Date.now());
    };



    const handleSuccess = (type) => {
        // type = 'home' (Efficiency) or 'mystery' (Discovery)
        setStatus('success');
        // Do NOT call onComplete yet. Wait for user rating.
    };

    const handleFinish = () => {
        const duration = startTime ? Date.now() - startTime : 0;

        onComplete({
            group: group,
            // outcome: 'arrival', 
            duration_ms: duration,
            distance_walked: metrics?.distanceWalked || 0,
            collected_lights: metrics?.collectedLights || 0,
            total_lights: metrics?.totalLights || 0,
            fog_path: metrics?.fogPath || [],
            confidence_rating: rating, // 1-5
            fog_influence: fogInfluence, // 'no' | 'yes'
            fog_motivation: fogMotivation // text
        });
    };

    if (status === 'intro') {
        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{ maxWidth: '500px', textAlign: 'left', padding: '40px' }}>
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>Studie: Navigation unter Unsicherheit</h2>
                    <p style={{ marginBottom: '20px', lineHeight: '1.6', color: '#555' }}>
                        In dieser Simulation untersuchen wir das Orientierungsverhalten bei eingeschränkter Sicht.
                    </p>
                    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e9ecef' }}>
                        <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '10px' }}>Aufgabe:</h3>
                        Finden Sie den Weg zum Zielpunkt (🏁).
                        <br /><br />
                        <ul style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.5' }}>
                            <li>Ihre Sicht ist durch <strong>Nebel</strong> eingeschränkt.</li>
                            <li>Ein <strong>Richtungspfeil</strong> am oberen Bildschirmrand zeigt Ihnen die Luftlinie zum Ziel.</li>
                            <li>Es gibt <strong>keine vorgegebene Route</strong>. Entscheiden Sie selbst.</li>
                        </ul>
                    </div>
                    <button className="mission-btn-primary" onClick={handleStart} style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}>
                        Simulation Starten
                    </button>
                </div>
            </div>
        );
    }



    if (status === 'success') {
        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{
                    textAlign: 'left',
                    maxWidth: '600px',
                    padding: '40px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    background: '#fff',
                    fontFamily: 'Inter, sans-serif'
                }}>
                    <h2 style={{ marginBottom: '10px', fontSize: '1.8rem', color: '#000', fontWeight: 'bold' }}>Ziel erreicht.</h2>
                    <p style={{ color: '#333', marginBottom: '30px', fontSize: '1rem', lineHeight: '1.5' }}>
                        Vielen Dank für die Teilnahme. Bitte beantworten Sie kurz diese zwei Fragen zur Auswertung der Simulation.
                    </p>

                    {/* Question 1: Confidence */}
                    <div style={{ marginBottom: '30px' }}>
                        <label style={{ display: 'block', marginBottom: '15px', color: '#000', fontSize: '1rem', fontWeight: '500' }}>
                            1. Wie sicher haben Sie sich bei der Orientierung gefühlt?
                        </label>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
                            {[
                                { val: 1, label: 'Sehr unsicher' },
                                { val: 2, label: 'Unsicher' },
                                { val: 3, label: 'Neutral' },
                                { val: 4, label: 'Sicher' },
                                { val: 5, label: 'Sehr sicher' }
                            ].map(opt => (
                                <button
                                    key={opt.val}
                                    onClick={() => setRating(opt.val)}
                                    style={{
                                        flex: 1,
                                        padding: '12px 5px',
                                        borderRadius: '6px',
                                        border: rating === opt.val ? '1px solid #000' : '1px solid #ddd',
                                        background: rating === opt.val ? '#f5f5f5' : 'white',
                                        color: '#000',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        lineHeight: '1.2'
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Question 2: Fog Influence */}
                    <div style={{ marginBottom: '40px' }}>
                        <label style={{ display: 'block', marginBottom: '15px', color: '#000', fontSize: '1rem', fontWeight: '500' }}>
                            2. Hat der Nebel Ihre Routenwahl maßgeblich beeinflusst?
                        </label>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <button
                                onClick={() => setFogInfluence('no')}
                                style={{
                                    flex: 1,
                                    padding: '15px',
                                    borderRadius: '6px',
                                    border: fogInfluence === 'no' ? '1px solid #000' : '1px solid #ddd',
                                    background: fogInfluence === 'no' ? '#f5f5f5' : 'white',
                                    color: '#000',
                                    cursor: 'pointer',
                                    textAlign: 'center'
                                }}
                            >
                                Nein, ich folgte strikt der Richtung.
                            </button>
                            <button
                                onClick={() => setFogInfluence('yes')}
                                style={{
                                    flex: 1,
                                    padding: '15px',
                                    borderRadius: '6px',
                                    border: fogInfluence === 'yes' ? '1px solid #000' : '1px solid #ddd',
                                    background: fogInfluence === 'yes' ? '#f5f5f5' : 'white',
                                    color: '#000',
                                    cursor: 'pointer',
                                    textAlign: 'center'
                                }}
                            >
                                Ja, ich musste oft ausweichen/suchen.
                            </button>
                        </div>
                    </div>

                    {/* Question 3: Motivation (Open Text) */}
                    <div style={{ marginBottom: '40px' }}>
                        <label style={{ display: 'block', marginBottom: '15px', color: '#000', fontSize: '1rem', fontWeight: '500' }}>
                            3. Inwiefern motiviert dich der Nebel, deine Route zu ändern, um mehr von der Karte freizuschalten?
                        </label>
                        <textarea
                            value={fogMotivation}
                            onChange={(e) => setFogMotivation(e.target.value)}
                            placeholder="Deine Antwort..."
                            style={{
                                width: '100%',
                                minHeight: '80px',
                                padding: '12px',
                                borderRadius: '6px',
                                border: '1px solid #ddd',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '0.95rem',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    <button
                        className="mission-btn-primary"
                        onClick={handleFinish}
                        disabled={!rating || !fogInfluence}
                        style={{
                            width: '200px',
                            padding: '12px',
                            background: '#1a1a1a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '1rem',
                            fontWeight: '500',
                            cursor: (rating && fogInfluence) ? 'pointer' : 'not-allowed',
                            opacity: (rating && fogInfluence) ? 1 : 0.5,
                            float: 'right'
                        }}
                    >
                        Abschließen
                    </button>
                    <div style={{ clear: 'both' }}></div>
                </div>
            </div>
        );
    }

    // Active Overlay (Hidden as per user request, using Map Arrow instead)
    return null;
}
