import React, { useState } from 'react';
import './StoryIntro.css';

const STORY_STEPS = [
    {
        title: "Willkommen, Explorer.",
        text: "Du wurdest für die Initiative 'Project Fog' ausgewählt.",
        action: "Initialisieren"
    },
    {
        title: "Das Phänomen",
        text: "Ein unbekannter Nebel verhüllt unsere Welt. Die Kommunikation ist eingeschränkt.",
        action: "Verbindung herstellen"
    },
    {
        title: "Dein Auftrag",
        text: "Wir entsenden dich in die Zone. Wir benötigen deine Augen vor Ort, um die Karte wiederherzustellen.",
        action: "Auftrag bestätigen"
    },
    {
        title: "Vorbereitung",
        text: "Bevor der Transfer beginnt, müssen wir deinen Status und deine Ausrüstung synchronisieren.",
        action: "Synchronisierung starten"
    }
];

export default function StoryIntro({ onComplete }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [fading, setFading] = useState(false);

    const handleNext = () => {
        setFading(true);
        setTimeout(() => {
            if (currentStep < STORY_STEPS.length - 1) {
                setCurrentStep(prev => prev + 1);
                setFading(false);
            } else {
                onComplete();
            }
        }, 500); // Wait for fade out
    };

    const step = STORY_STEPS[currentStep];

    return (
        <div className="story-container">
            <div className={`story-content ${fading ? 'fade-out' : 'fade-in'}`}>
                <h1 className="story-title">{step.title}</h1>
                <p className="story-text">{step.text}</p>

                <div className="story-progress">
                    {STORY_STEPS.map((_, i) => (
                        <div key={i} className={`progress-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`} />
                    ))}
                </div>

                <button className="story-action-btn" onClick={handleNext}>
                    {step.action}
                </button>
            </div>
        </div>
    );
}
