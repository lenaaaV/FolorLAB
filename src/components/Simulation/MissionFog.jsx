import React, { useState, useEffect } from 'react';
import './MissionOne.css'; // Re-use styling

export default function MissionFog({ onComplete }) {
    const [group, setGroup] = useState(null); // 'A' (Clear) or 'B' (Fog)
    const [status, setStatus] = useState('intro'); // intro | active | success
    const [startTime, setStartTime] = useState(null);
    const [distance, setDistance] = useState(0);

    // Initial Random Assignment
    useEffect(() => {
        // Simple A/B Split
        const assignedGroup = Math.random() > 0.5 ? 'A' : 'B';
        setGroup(assignedGroup);
        console.log("Mission Fog Assigned Group:", assignedGroup);
    }, []);

    const handleStart = () => {
        setStatus('active');
        setStartTime(Date.now());
    };

    const handleSuccess = (type) => {
        // type = 'home' (Efficiency) or 'mystery' (Discovery)
        setStatus('success');
        const duration = Date.now() - startTime;

        onComplete({
            group: group,
            outcome: type,
            duration_ms: duration,
            distance_walked: distance // In a real app we'd track this precisely
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
                <div className="mission-card">
                    <h2>Ziel erreicht!</h2>
                    <p>Daten wurden gespeichert.</p>
                </div>
            </div>
        );
    }

    // Active Overlay (Minimal)
    return (
        <div className="mission-status-overlay" style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'white',
            padding: '10px 20px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 1000,
            textAlign: 'center'
        }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Finde den Weg</h3>
            <p style={{ margin: '5px 0 0', fontSize: '0.8rem', color: '#666' }}>
                Klicke auf die Karte um deine Position zu ändern.
            </p>
        </div>
    );
}
