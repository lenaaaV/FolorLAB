import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './Collection.css';

export default function Collection({ session }) {
    const [visitedPoints, setVisitedPoints] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedBadge, setSelectedBadge] = useState(null);

    const BADGES = [
        { id: 1, name: 'Neuling', icon: '🌱', threshold: 0, description: 'Der Anfang ist gemacht. Du hast deine erste Reise begonnen.' },
        { id: 2, name: 'Entdecker', icon: '🧭', threshold: 5, description: 'Du hast 5 Orte besucht und beginnst, die Welt zu verstehen.' },
        { id: 3, name: 'Pionier', icon: '🚀', threshold: 10, description: '10 Orte! Du bist auf dem besten Weg, ein Legende zu werden.' },
        { id: 4, name: 'Kartograph', icon: '🗺️', threshold: 20, description: '20 Orte. Die Karte ist dein Zuhause.' },
    ];

    useEffect(() => {
        if (session?.user?.id) {
            const fetchProfile = async () => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('visited_points')
                    .eq('id', session.user.id)
                    .single();

                if (error) {
                    console.error('Error fetching profile:', error);
                } else if (data) {
                    setVisitedPoints(data.visited_points || []);
                }
                setLoading(false);
            };
            fetchProfile();
        }
    }, [session]);

    return (
        <div className="collection-view">
            <h2 className="collection-title">Deine Sammlung</h2>

            <div className="collection-book">
                <div className="book-spine"></div>
                <div className="book-page">
                    <div className="page-header">
                        <h3>Abzeichen</h3>
                        <span className="page-number">Seite 1</span>
                    </div>

                    <div className="sticker-grid">
                        {BADGES.map((badge) => {
                            const isUnlocked = visitedPoints.length >= badge.threshold;
                            return (
                                <div
                                    key={badge.id}
                                    className={`sticker-slot ${isUnlocked ? 'unlocked' : 'locked'}`}
                                    onClick={() => setSelectedBadge({ ...badge, isUnlocked })}
                                >
                                    <div className="sticker-content">
                                        <div className="sticker-icon">{badge.icon}</div>
                                        <span className="sticker-name">{badge.name}</span>
                                    </div>
                                    {!isUnlocked && (
                                        <div className="sticker-placeholder">
                                            <span>?</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {selectedBadge && (
                <div className="badge-modal-overlay" onClick={() => setSelectedBadge(null)}>
                    <div className="badge-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="badge-modal-close" onClick={() => setSelectedBadge(null)}>×</button>
                        <div className="badge-modal-icon">{selectedBadge.icon}</div>
                        <h3 className="badge-modal-title">{selectedBadge.name}</h3>
                        <p className="badge-modal-desc">{selectedBadge.description}</p>
                        <div className={`badge-modal-status ${selectedBadge.isUnlocked ? 'unlocked' : 'locked'}`}>
                            {selectedBadge.isUnlocked ? 'Freigeschaltet' : `Benötigt ${selectedBadge.threshold} Orte`}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
