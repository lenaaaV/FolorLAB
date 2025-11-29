import React from 'react';
import './LoadingScreen.css';

export default function LoadingScreen({ text, progress }) {
    return (
        <div className="loading-screen">
            <div className="loading-content">
                <div className="logo-animation">
                    {/* Lines first so they are behind dots if overlapping */}
                    <div className="line line-1"></div>
                    <div className="line line-2"></div>

                    <div className="dot dot-tl"></div>
                    <div className="dot dot-bl"></div>
                    <div className="dot dot-tr"></div>
                    <div className="dot dot-br"></div>
                </div>
                {progress !== undefined && (
                    <div className="loading-progress-container">
                        <div
                            className="loading-progress-bar"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                )}

                <div className="loading-text">{text || "Laden..."}</div>
            </div>
        </div>
    );
}
