import React, { useState, useEffect, useRef } from 'react';
import './ReactionTestScreen.css';

export default function ReactionTestScreen({ onComplete }) {
    const [round, setRound] = useState(0);
    const [active, setActive] = useState(false);
    const [results, setResults] = useState([]);
    const [position, setPosition] = useState({ top: '50%', left: '50%' });
    const [currentSize, setCurrentSize] = useState('medium'); // small, medium, large
    const [dotVisible, setDotVisible] = useState(false);

    const startTimeRef = useRef(null);
    const maxRounds = 5;

    useEffect(() => {
        if (active && round < maxRounds && !dotVisible) {
            // Delay before showing next dot
            const delay = Math.random() * 1000 + 500; // 500-1500ms
            const timer = setTimeout(() => {
                spawnDot();
            }, delay);
            return () => clearTimeout(timer);
        }
        // Removed auto-advance logic (User must click Start)
    }, [active, round, dotVisible]);

    const spawnDot = () => {
        // Random position (padding 10% to avoid edges)
        const top = Math.random() * 80 + 10;
        const left = Math.random() * 80 + 10;

        // Random size
        const sizes = ['small', 'medium', 'medium', 'large'];
        const size = sizes[Math.floor(Math.random() * sizes.length)];

        setPosition({ top: `${top}%`, left: `${left}%` });
        setCurrentSize(size);
        setDotVisible(true);
        startTimeRef.current = Date.now();
    };

    const handleClick = () => {
        if (!dotVisible) return;

        const latency = Date.now() - startTimeRef.current;
        setDotVisible(false);

        setResults(prev => [
            ...prev,
            {
                round: round + 1,
                size: currentSize,
                latency_ms: latency
            }
        ]);

        setRound(prev => prev + 1);
    };

    const startTest = () => {
        setActive(true);
    };

    const handleSkip = () => {
        // Mock results for skipping
        const mockResults = Array(5).fill(0).map((_, i) => ({
            round: i + 1,
            size: 'medium',
            latency_ms: 350 + Math.floor(Math.random() * 100)
        }));
        onComplete(mockResults);
    };

    if (!active) {
        return (
            <div className="reaction-intro">
                <div className="reaction-box">
                    <h2 className="reaction-title">Phase 2: Kalibrierung</h2>
                    <p className="reaction-text">
                        Wir müssen deine Reaktionszeit messen, um die Simulation anpassen zu können.
                        <br /><br />
                        Klicke so schnell wie möglich auf die erscheinenden Punkte.
                    </p>
                    <button onClick={startTest} className="reaction-start-btn">Starten (5 Runden)</button>
                    <button onClick={handleSkip} className="reaction-skip-btn" style={{ marginTop: '10px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}>
                        Überspringen
                    </button>
                </div>
            </div>
        );
    }

    // Updated Logic:
    // If we reached maxRounds, show success screen.
    // The previous useEffect removed auto-advance, so now we rely on re-rendering.

    if (round >= maxRounds) {
        // Calculate Stats
        const totalLatency = results.reduce((acc, curr) => acc + curr.latency_ms, 0);
        const avgLatency = results.length > 0 ? Math.round(totalLatency / results.length) : 0;

        return (
            <div className="reaction-intro">
                <div className="reaction-box">
                    <h2 className="reaction-title">Phase 2: Erfolgreich</h2>
                    <div className="reaction-results-summary" style={{ margin: '20px 0' }}>
                        <p style={{ marginBottom: '10px' }}>Sensoren wurden synchronisiert.</p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 'bold', color: '#2c3e50' }}>
                            <span>Ø Reaktion:</span>
                            <span>{avgLatency} ms</span>
                        </div>
                    </div>
                    <p className="reaction-text" style={{ fontSize: '0.9rem' }}>
                        Der Upload der Daten ist bereit. Du kannst nun die Simulation starten.
                    </p>
                    <button
                        className="reaction-start-btn"
                        onClick={() => {
                            console.log("Start Simulation Clicked - Results:", results);
                            onComplete(results);
                        }}
                    >
                        Simulation starten
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="reaction-area">
            <div className="reaction-top-bar" style={{ position: 'absolute', top: 10, right: 10, zIndex: 100 }}>
                <button onClick={handleSkip} style={{ background: 'rgba(255,255,255,0.5)', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Skip</button>
            </div>
            <div className="reaction-counter">Runde {round + 1} / {maxRounds}</div>
            {dotVisible && (
                <button
                    className={`reaction-dot size-${currentSize}`}
                    style={{ top: position.top, left: position.left }}
                    onMouseDown={handleClick} // onMouseDown for faster response
                />
            )}
        </div>
    );
}
