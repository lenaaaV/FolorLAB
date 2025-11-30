import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { calculateLevel } from '../utils/levelLogic';
import './Leaderboard.css';

export default function Leaderboard({ session }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeFrame, setTimeFrame] = useState('allTime'); // 'allTime', 'weekly'

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, visited_points');

            if (error) throw error;

            // Calculate XP and Sort
            const processedUsers = data.map(user => {
                const stats = calculateLevel(user.visited_points || []);
                return {
                    ...user,
                    xp: stats.totalXP,
                    level: stats.level,
                    visitedCount: (user.visited_points || []).length
                };
            }).sort((a, b) => b.xp - a.xp);

            // Add Rank
            const rankedUsers = processedUsers.map((user, index) => ({
                ...user,
                rank: index + 1
            }));

            setUsers(rankedUsers);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const getRankEmoji = (rank) => {
        if (rank === 1) return '👑';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return rank;
    };

    return (
        <div className="leaderboard-container">
            <div className="leaderboard-header">
                <h2>Bestenliste</h2>
                <div className="leaderboard-tabs">
                    <button
                        className={`tab-btn ${timeFrame === 'allTime' ? 'active' : ''}`}
                        onClick={() => setTimeFrame('allTime')}
                    >
                        Gesamt
                    </button>
                    <button
                        className={`tab-btn ${timeFrame === 'weekly' ? 'active' : ''}`}
                        onClick={() => setTimeFrame('weekly')}
                        disabled
                        title="Kommt bald!"
                    >
                        Wöchentlich
                    </button>
                </div>
            </div>

            <div className="leaderboard-list">
                {loading ? (
                    <div className="loading-state">Lade Ranking...</div>
                ) : (
                    users.map((user) => (
                        <div
                            key={user.id}
                            className={`leaderboard-item ${session?.user?.id === user.id ? 'current-user' : ''}`}
                        >
                            <div className="rank-col">
                                <span className="rank-display">{getRankEmoji(user.rank)}</span>
                            </div>

                            <div className="user-col">
                                <div className="user-avatar-small">
                                    {user.avatar_url ? (
                                        <img
                                            src={supabase.storage.from('avatars').getPublicUrl(user.avatar_url).data.publicUrl}
                                            alt={user.username}
                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/40' }}
                                        />
                                    ) : (
                                        <div className="avatar-placeholder">{user.username ? user.username[0].toUpperCase() : '?'}</div>
                                    )}
                                </div>
                                <div className="user-info">
                                    <span className="username">{user.username || 'Unbekannt'}</span>
                                    <span className="user-level">Lvl {user.level} • {user.visitedCount} Spots</span>
                                </div>
                            </div>

                            <div className="xp-col">
                                <span className="xp-value">{user.xp}</span>
                                <span className="xp-label">XP</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
