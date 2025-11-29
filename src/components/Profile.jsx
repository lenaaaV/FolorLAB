import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './Profile.css';

export default function Profile({ session }) {
    const [visitedPoints, setVisitedPoints] = useState([]);
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (session?.user?.id) {
            const fetchProfile = async () => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('visited_points, username')
                    .eq('id', session.user.id)
                    .single();

                if (error) {
                    console.error('Error fetching profile:', error);
                } else if (data) {
                    setVisitedPoints(data.visited_points || []);
                    setUsername(data.username || '');
                }
                setLoading(false);
            };
            fetchProfile();
        }
    }, [session]);

    const handleUpdateProfile = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('profiles')
            .update({ username })
            .eq('id', session.user.id);

        if (error) {
            alert('Fehler beim Speichern des Profils.');
            console.error(error);
        } else {
            // Optional: Show success feedback
        }
        setSaving(false);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <div className="profile-view">
            <div className="profile-header-section">
                <div className="profile-avatar-large">
                    <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>
                <h2>Dein Profil</h2>

                <div className="profile-input-group">
                    <input
                        type="text"
                        className="profile-username-input"
                        placeholder="Dein Name"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onBlur={handleUpdateProfile}
                    />
                    <div className="input-underline"></div>
                </div>

                <p className="profile-email">{session?.user?.email}</p>
            </div>

            <div className="profile-stats-grid">
                <div className="stat-card">
                    <div className="stat-icon-wrapper">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{visitedPoints.length}</span>
                        <span className="stat-label">Besuchte Orte</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon-wrapper">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{Math.round(visitedPoints.length * 150)}</span>
                        <span className="stat-label">Schritte</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon-wrapper">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{Math.round(visitedPoints.length * 0.2)} km²</span>
                        <span className="stat-label">Erkundet</span>
                    </div>
                </div>
            </div>

            <div className="profile-actions">
                <button className="sign-out-btn" onClick={handleSignOut}>
                    Abmelden
                </button>
            </div>
        </div>
    );
}
