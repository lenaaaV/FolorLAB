import React from 'react';
import './WelcomeScreen.css';

export default function WelcomeScreen({ onStart }) {
  return (
    <div className="welcome-screen-container">
      <div className="welcome-content">
        <img src="/logo.png" alt="FolorLab Logo" className="welcome-logo" />
        <h1 className="welcome-title">Willkommen im Labor</h1>
        <p className="welcome-text">
          Diese Simulation dauert ca. 15 Minuten. Bitte versetze dich in die Lage, 
          dass du an einem freien Nachmittag deine Stadt erkundest.
        </p>
        <button onClick={onStart} className="welcome-start-button">
          Simulation starten
        </button>
      </div>
    </div>
  );
}
