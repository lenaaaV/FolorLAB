import React, { useState } from 'react';
import './MissionOne.css'; // Re-use styling

/**
 * MissionCreation Component (Mission 5)
 * 
 * Hypothesis: "Privacy/Effort hurdles (Henne-Ei-Problem) prevent content creation"
 * 
 * Flow:
 * 1. Intro -> 2. Walk -> 3. Arrival (Show Photo) -> 4. Click "+"
 * 5. Barrier 1: Camera Access (Yes/No)
 * 6. Barrier 2: Real Name Access (Yes/No)
 * 7. Feedback (if dropped off or finished)
 */
export default function MissionCreation({ onComplete, isAtTarget, distanceToTarget }) {
    // States: intro, active, arrived, barrier_camera, barrier_name, feedback, success
    const [status, setStatus] = useState('intro');
    const [startTime, setStartTime] = useState(null);

    // Tracking Data
    const [dropOffPoint, setDropOffPoint] = useState(null); // 'none', 'camera', 'name'
    const [feedback, setFeedback] = useState({
        reason: '',
        anonymous_helpful: null, // boolean
        user_type: null // 'consumer', 'creator', 'both'
    });

    const handleStart = () => {
        setStatus('active');
        setStartTime(Date.now());
    };

    const handleArrivalAction = () => {
        setStatus('barrier_camera');
    };

    const handleCameraPermission = (allowed) => {
        if (allowed) {
            setStatus('barrier_name');
        } else {
            setDropOffPoint('camera');
            setStatus('feedback');
        }
    };

    const handleNamePermission = (allowed) => {
        if (allowed) {
            setDropOffPoint('none'); // Success path
            setStatus('success'); // Or go to feedback to collect "Consumer/Creator" data anyway? 
            // User prompted: "When 50% drop off... then feedback". 
            // Let's show success first, then maybe a short "Bonus Question" or just end.
            // Re-reading promise: "The Learning: ... Then appears a feedback window." 
            // I will show feedback for EVERYONE to get the "Consumer vs Creator" data, 
            // but modify the intro text based on success/fail.
            setStatus('feedback');
        } else {
            setDropOffPoint('name');
            setStatus('feedback');
        }
    };

    const submitFeedback = () => {
        const duration = Date.now() - startTime;
        onComplete({
            mission: 'creation_barrier',
            drop_off_point: dropOffPoint,
            feedback_data: feedback,
            decision_time_ms: duration
        });
    };

    // ==================== INTRO ====================
    if (status === 'intro') {
        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{ maxWidth: '500px', textAlign: 'center', padding: '40px' }}>
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>
                        Deine Entdeckung 🗺️
                    </h2>
                    <p style={{ marginBottom: '30px', lineHeight: '1.6', color: '#555', fontSize: '1.1rem' }}>
                        Du hast einen besonderen Ort entdeckt. <br />
                        Andere Nutzer würden ihn sicher gerne sehen.
                    </p>
                    <button
                        className="mission-btn-primary"
                        onClick={handleStart}
                        style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}
                    >
                        Hingehen
                    </button>
                </div>
            </div>
        );
    }

    // ==================== ACTIVE (Walking) ====================
    if (status === 'active' && !isAtTarget) {
        return (
            <div className="mission-overlay" style={{ pointerEvents: 'none' }}>
                <div className="mission-card" style={{ textAlign: 'center', padding: '20px', pointerEvents: 'auto' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Gehe zum Ziel... 📍</h2>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                        Entfernung: <strong style={{ color: '#333' }}>{distanceToTarget ? Math.round(distanceToTarget) + ' m' : '...'}</strong>
                    </p>
                </div>
            </div>
        );
    }

    // ==================== ARRIVED (Show Photo + Task) ====================
    if ((status === 'active' && isAtTarget) || status === 'arrived') {
        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{ textAlign: 'center', padding: '0', overflow: 'hidden', maxWidth: '400px' }}>

                    {/* Location Photo Header */}
                    <div style={{
                        height: '200px',
                        background: 'linear-gradient(to bottom right, #FF9966, #FF5E62)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}>
                        <div style={{ fontSize: '4rem' }}>🏰</div>
                        <div style={{
                            position: 'absolute', bottom: '10px', left: '15px',
                            color: 'white', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}>
                            Schlossgarten
                        </div>
                    </div>

                    <div style={{ padding: '30px' }}>
                        <h2 style={{ fontSize: '1.4rem', marginBottom: '15px' }}>
                            Ein toller Ort!
                        </h2>
                        <p style={{ marginBottom: '25px', color: '#666', lineHeight: '1.5' }}>
                            Erstelle jetzt ein <strong>Memory Board</strong> für diesen Ort, damit andere ihn auch finden können.
                        </p>

                        <button
                            onClick={handleArrivalAction}
                            style={{
                                background: '#1a1a1a', color: 'white',
                                border: 'none', padding: '15px 30px', borderRadius: '50px',
                                fontSize: '1.5rem', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', margin: '0 auto',
                                boxShadow: '0 6px 20px rgba(0,0,0,0.2)', cursor: 'pointer'
                            }}
                        >
                            <span style={{ marginRight: '10px' }}>+</span> Board erstellen
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ==================== BARRIERS (Standard Question UI) ====================
    if (status === 'barrier_camera' || status === 'barrier_name') {
        const isCamera = status === 'barrier_camera';
        const title = isCamera ? 'Zugriff auf Kamera?' : 'Echten Namen anzeigen?';
        const subtext = isCamera
            ? 'Wir benötigen Zugriff auf deine Kamera, um ein Foto für das Memory Board aufzunehmen.'
            : 'Beiträge werden standardmäßig mit deinem echten Namen ("Lena") veröffentlicht, um Vertrauen zu schaffen.';
        const icon = isCamera ? '📸' : '👤';

        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{ textAlign: 'center', padding: '30px', maxWidth: '400px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '20px' }}>{icon}</div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>
                        {title}
                    </h2>
                    <p style={{ marginBottom: '30px', lineHeight: '1.5', color: '#555' }}>
                        {subtext}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <button
                            onClick={() => isCamera ? handleCameraPermission(true) : handleNamePermission(true)}
                            className="mission-btn-primary"
                            style={{ width: '100%', padding: '15px' }}
                        >
                            {isCamera ? 'Kamera erlauben' : 'Ja, Namen anzeigen'}
                        </button>

                        <button
                            onClick={() => isCamera ? handleCameraPermission(false) : handleNamePermission(false)}
                            style={{
                                background: 'transparent', color: '#999', border: '2px solid #eee',
                                padding: '15px', borderRadius: '12px', fontSize: '1rem',
                                fontWeight: '600', cursor: 'pointer'
                            }}
                        >
                            {isCamera ? 'Nein, danke' : 'Lieber anonym bleiben'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ==================== FEEDBACK (Why?) ====================
    if (status === 'feedback') {
        return (
            <div className="mission-overlay">
                <div className="mission-card" style={{ maxWidth: '500px', padding: '30px', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>
                        {dropOffPoint === 'none' ? 'Vielen Dank! 🎉' : 'Abgebrochen'}
                    </h2>
                    <p style={{ color: '#666', marginBottom: '25px' }}>
                        {dropOffPoint === 'none'
                            ? 'Dein Board wurde erstellt. Helfe uns kurz, die Plattform zu verbessern.'
                            : 'Du hast den Vorgang abgebrochen. Dein Feedback ist uns wichtig!'}
                    </p>

                    {/* Question 1: Reason (if dropped off) */}
                    {dropOffPoint !== 'none' && (
                        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                                Warum hast du dich dagegen entschieden?
                            </label>
                            <textarea
                                value={feedback.reason}
                                onChange={(e) => setFeedback({ ...feedback, reason: e.target.value })}
                                style={{
                                    width: '100%', padding: '10px', borderRadius: '8px',
                                    border: '1px solid #ddd', minHeight: '60px'
                                }}
                                placeholder="Zu privat / zu aufwendig / ..."
                            />
                        </div>
                    )}

                    {/* Question 2: Anonymous Mode */}
                    <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                            Würde dir ein "Anonym-Modus" helfen?
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {['Ja, sehr', 'Vielleicht', 'Nein'].map(opt => (
                                <button key={opt}
                                    onClick={() => setFeedback({ ...feedback, anonymous_helpful: opt })}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '8px',
                                        border: `1px solid ${feedback.anonymous_helpful === opt ? '#333' : '#ddd'}`,
                                        background: feedback.anonymous_helpful === opt ? '#333' : 'white',
                                        color: feedback.anonymous_helpful === opt ? 'white' : '#333',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Question 3: Consumer vs Creator */}
                    <div style={{ textAlign: 'left', marginBottom: '30px' }}>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                            Bist du eher Creator oder Konsument?
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {[
                                { val: 'creator', label: '📸 Creator' },
                                { val: 'consumer', label: '👀 Konsument' },
                                { val: 'both', label: '🔄 Beides' },
                            ].map(opt => (
                                <button key={opt.val}
                                    onClick={() => setFeedback({ ...feedback, user_type: opt.val })}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '8px',
                                        border: `1px solid ${feedback.user_type === opt.val ? '#333' : '#ddd'}`,
                                        background: feedback.user_type === opt.val ? '#333' : 'white',
                                        color: feedback.user_type === opt.val ? 'white' : '#333',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        className="mission-btn-primary"
                        onClick={submitFeedback}
                        disabled={!feedback.user_type} // Require at least one Answer
                        style={{ width: '100%', padding: '15px', opacity: feedback.user_type ? 1 : 0.5 }}
                    >
                        Absenden & Fertig
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
