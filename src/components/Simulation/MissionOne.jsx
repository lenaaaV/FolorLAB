import React, { useState, useEffect } from 'react';
import './MissionOne.css';

export default function MissionOne({ onComplete }) {
    const [startTime, setStartTime] = useState(null);

    useEffect(() => {
        setStartTime(Date.now());
    }, []);

    const handleChoice = (choiceType) => {
        const duration = Date.now() - startTime;
        console.log(`Mission 1 Choice: ${choiceType}, Duration: ${duration}ms`);
        onComplete({
            mission_id: '1_temptation',
            choice: choiceType,
            duration_ms: duration,
            timestamp: new Date().toISOString()
        });
    };

    return (
        <div className="mission-container">
            {/* Background Map Image (Placeholder Color for now) */}
            <div className="mission-map-bg">

                {/* Click Zones */}
                {/* Zone A: Uni (Efficiency) - Bottom Center/Left */}
                <div
                    className="click-zone zone-efficiency"
                    onClick={() => handleChoice('efficiency')}
                    title="Zur Uni (Direkter Weg)"
                />

                {/* Zone B: Park (Discovery) - Top Right (Green Area) */}
                <div
                    className="click-zone zone-discovery"
                    onClick={() => handleChoice('discovery')}
                    title="Zum Memory Board (Erkunden)"
                />
            </div>

            {/* Narrative Overlay */}
            <div className="mission-overlay">
                <div className="mission-card">
                    <h2 className="mission-title">Mission 1: Die Versuchung</h2>
                    <p className="mission-text">
                        Du stehst am <strong>Willy-Brandt-Platz</strong> und musst dringend zur <strong>Uni</strong> (Mitte).
                        <br /><br />
                        Der direkte Weg führt geradeaus durch die Stadt.
                        <br />
                        <em>Aber:</em> Im <strong>Herrngarten</strong> (oben im Nebel) ist gerade ein seltenes <strong>Memory Board</strong> aufgetaucht.
                    </p>
                    <div className="mission-hint">
                        Tippe auf dein Ziel auf der Karte.
                    </div>
                </div>
            </div>
        </div>
    );
}
