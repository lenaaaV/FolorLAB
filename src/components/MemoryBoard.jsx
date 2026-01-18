import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import './MemoryBoard.css';

export default function MemoryBoard({ onClose, locationName = "Alte Brücke", locationImage }) {
    const [activeTab, setActiveTab] = useState('community');
    const [showNewMoment, setShowNewMoment] = useState(false);
    const [newPostText, setNewPostText] = useState("");
    const [visibility, setVisibility] = useState('public');
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const [mediaType, setMediaType] = useState('text'); // 'text', 'image', 'audio'
    const [replyingTo, setReplyingTo] = useState(null); // ID of post being replied to
    const [replyText, setReplyText] = useState("");
    const fileInputRef = useRef(null);

    // Fetch posts from Supabase
    useEffect(() => {
        fetchPosts();
    }, [activeTab, locationName]);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            let formattedPosts = [];

            let query = supabase
                .from('posts')
                .select('*')
                .eq('location_name', locationName)
                .order('created_at', { ascending: false });

            if (activeTab === 'community') {
                query = query.eq('visibility', 'public');
            } else if (activeTab === 'mine') {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    query = query.eq('user_id', user.id);
                }
            } else if (activeTab === 'friends') {
                query = query.eq('visibility', 'friends');
            }

            const { data, error } = await query;

            if (error) throw error;

            // Transform data for UI
            formattedPosts = data.map(post => ({
                id: post.id,
                author: post.author_name || 'Anonym',
                time: new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content: post.content,
                type: post.media_type || 'text',
                image: post.media_type === 'image' ? post.media_url : null,
                video: post.media_type === 'video' ? post.media_url : null,
                avatar: "👤", // Placeholder
                replies: [] // Initialize empty replies
            }));

            setPosts(formattedPosts);
        } catch (error) {
            console.error('Error fetching posts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setMediaFile(file);
            if (file.type.startsWith('image/')) {
                setMediaType('image');
            } else if (file.type.startsWith('video/')) {
                setMediaType('video');
            } else {
                setMediaType('audio');
            }
            setMediaPreview(URL.createObjectURL(file));
        }
    };

    const handlePostSubmit = async () => {
        if (!newPostText.trim() && !mediaFile) return;

        setUploading(true);
        try {


            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            let mediaUrl = null;
            let type = 'text';

            // Upload media if exists
            if (mediaFile) {
                const fileExt = mediaFile.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('media')
                    .upload(filePath, mediaFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('media')
                    .getPublicUrl(filePath);

                mediaUrl = publicUrl;
                type = mediaType;
            }

            // Create post
            const { error: postError } = await supabase
                .from('posts')
                .insert({
                    user_id: user.id,
                    content: newPostText,
                    location_name: locationName,
                    visibility: visibility,
                    media_url: mediaUrl,
                    media_type: type,
                    type: type, // Include 'type' for compatibility with existing schema
                    author_name: visibility === 'anon' ? 'Anonym' : (user.email?.split('@')[0] || 'User')
                });

            if (postError) throw postError;

            // Reset and refresh
            setNewPostText("");
            setMediaFile(null);
            setMediaPreview(null);
            setShowNewMoment(false);
            fetchPosts();

        } catch (error) {
            console.error('Error creating post:', error);
            alert(`Fehler beim Posten: ${error.message || error.error_description || JSON.stringify(error)}`);
        } finally {
            setUploading(false);
        }
    };

    const handleReplySubmit = (postId) => {
        if (!replyText.trim()) return;

        const newReply = {
            id: `reply-${Date.now()}`,
            author: 'Du',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: replyText,
            type: 'text',
            avatar: "👤"
        };

        const updatedPosts = posts.map(post => {
            if (post.id === postId) {
                return { ...post, replies: [...(post.replies || []), newReply] };
            }
            return post;
        });

        setPosts(updatedPosts);
        setReplyingTo(null);
        setReplyText("");
    };

    return (
        <div className="memory-board-overlay" onClick={onClose}>
            <div className="memory-board-container" onClick={e => e.stopPropagation()}>

                {!showNewMoment ? (
                    <>
                        {/* Header */}
                        <div className="board-header-image" style={{ backgroundImage: `url(${locationImage || 'https://images.unsplash.com/photo-1589561084771-04f7b6a25281?q=80&w=2070&auto=format&fit=crop'})` }}>
                            <div className="board-header-overlay">
                                <button className="close-board-btn" onClick={onClose}>×</button>
                                <div className="location-badge">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                                    ENTDECKT
                                </div>
                                <h1 className="location-title">{locationName}</h1>
                                <div className="location-stats">
                                    <span className="dot" style={{ color: '#4cd137' }}>●</span> {posts.length} Momente
                                    <div className="avatars-preview">
                                        <div className="avatar-mini"></div>
                                        <div className="avatar-mini"></div>
                                        <div className="avatar-mini"></div>
                                        <div className="avatar-mini" style={{ background: 'white', color: '#333', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+120</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="board-tabs">
                            <button
                                className={`tab-btn ${activeTab === 'community' ? 'active' : ''}`}
                                onClick={() => setActiveTab('community')}
                            >
                                Community
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
                                onClick={() => setActiveTab('friends')}
                            >
                                Freunde
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'mine' ? 'active' : ''}`}
                                onClick={() => setActiveTab('mine')}
                            >
                                Meine
                            </button>
                        </div>

                        {/* Content List */}
                        <div className="board-content-scroll">
                            {loading ? (
                                <div className="loading-spinner">Lade Momente...</div>
                            ) : posts.length === 0 ? (
                                <div className="empty-state">Noch keine Momente hier. Sei der Erste!</div>
                            ) : (
                                posts.map(post => (
                                    <div key={post.id} className="moment-card">
                                        <div className="moment-header">
                                            <div className="moment-avatar">{post.avatar}</div>
                                            <div className="moment-info">
                                                <h4>{post.author}</h4>
                                                <span className="moment-time">{post.time}</span>
                                            </div>
                                            <span className="moment-badge">PUBLIC</span>
                                        </div>

                                        {post.content && <p className="moment-text">{post.content}</p>}

                                        {post.type === 'image' && post.image && (
                                            <img src={post.image} alt="Moment" className="moment-image" />
                                        )}

                                        {post.type === 'video' && post.video && (
                                            <video src={post.video} controls className="moment-video" />
                                        )}

                                        {/* Replies */}
                                        {post.replies && post.replies.length > 0 && (
                                            <div className="replies-container">
                                                {post.replies.map(reply => (
                                                    <div key={reply.id} className="reply-card">
                                                        <div className="reply-header">
                                                            <span className="reply-author">{reply.author}</span>
                                                            <span className="reply-time">{reply.time}</span>
                                                        </div>
                                                        <p className="reply-text">{reply.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Reply Action */}
                                        <div className="card-actions">
                                            <button
                                                className="action-btn reply-btn"
                                                onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                                Antworten
                                            </button>
                                        </div>

                                        {/* Reply Input */}
                                        {replyingTo === post.id && (
                                            <div className="reply-input-container">
                                                <input
                                                    type="text"
                                                    className="reply-input"
                                                    placeholder="Schreibe eine Antwort..."
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    autoFocus
                                                    onKeyPress={(e) => e.key === 'Enter' && handleReplySubmit(post.id)}
                                                />
                                                <button
                                                    className="send-reply-btn"
                                                    onClick={() => handleReplySubmit(post.id)}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}

                            {/* Spacer for FAB */}
                            <div style={{ height: '80px' }}></div>
                        </div>

                        {/* FAB */}
                        <button className="add-moment-btn" onClick={() => setShowNewMoment(true)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                    </>
                ) : (
                    /* New Moment Modal */
                    <div className="new-moment-modal">
                        <div className="new-moment-header">
                            <button className="close-modal-btn" onClick={() => setShowNewMoment(false)}>×</button>
                            <h3>Neuer Moment</h3>
                            <button
                                className="post-action-btn"
                                onClick={handlePostSubmit}
                                disabled={uploading}
                            >
                                {uploading ? 'Postet...' : 'Posten'}
                            </button>
                        </div>

                        <div className="new-moment-content">
                            <textarea
                                className="moment-input"
                                placeholder="Erzähle deine Geschichte..."
                                value={newPostText}
                                onChange={(e) => setNewPostText(e.target.value)}
                                autoFocus
                            />

                            {mediaPreview && (
                                <div className="media-preview">
                                    {mediaType === 'video' ? (
                                        <video src={mediaPreview} controls className="preview-video" />
                                    ) : (
                                        <img src={mediaPreview} alt="Preview" />
                                    )}
                                    <button onClick={() => {
                                        setMediaFile(null);
                                        setMediaPreview(null);
                                    }}>×</button>
                                </div>
                            )}

                            <div className="visibility-selector">
                                <button
                                    className={`vis-btn ${visibility === 'public' ? 'active' : ''}`}
                                    onClick={() => setVisibility('public')}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    Öffentlich
                                </button>
                                <button
                                    className={`vis-btn ${visibility === 'anon' ? 'active' : ''}`}
                                    onClick={() => setVisibility('anon')}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    Anonym
                                </button>
                                <button
                                    className={`vis-btn ${visibility === 'private' ? 'active' : ''}`}
                                    onClick={() => setVisibility('private')}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                    Privat
                                </button>
                            </div>

                            <div className="media-options">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*,video/*"
                                    onChange={handleFileSelect}
                                />
                                <button className="media-btn" onClick={() => fileInputRef.current.click()}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    <span>Foto/Video</span>
                                </button>
                                <button className="media-btn">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                    <span>Audio</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper for bearing
function getBearing(startLat, startLng, destLat, destLng) {
    const startLatRad = startLat * (Math.PI / 180);
    const startLngRad = startLng * (Math.PI / 180);
    const destLatRad = destLat * (Math.PI / 180);
    const destLngRad = destLng * (Math.PI / 180);

    const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
    const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
        Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
    const brng = Math.atan2(y, x);
    const brngDeg = (brng * 180 / Math.PI + 360) % 360;
    return brngDeg;
}

// --- TARGET INDICATOR COMPONENT ---
export function TargetIndicator({ userLat, userLng, targetLat, targetLng, distance, bearing: explicitBearing }) {
    if ((!userLat || !userLng) && explicitBearing === undefined) return null;

    const bearing = explicitBearing !== undefined
        ? explicitBearing
        : getBearing(userLat, userLng, targetLat, targetLng);

    // Format distance
    const distDisplay = distance > 1000
        ? `${(distance / 1000).toFixed(1)} km`
        : `${Math.round(distance)} m`;

    return (
        <div style={{
            position: 'absolute',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 50,
            pointerEvents: 'none'
        }}>
            <div style={{
                width: '50px',
                height: '50px',
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                border: '3px solid #00ff88',
                transform: `rotate(${bearing}deg)`,
                transition: 'transform 0.1s linear'
            }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
            </div>
            <div style={{
                marginTop: '8px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
            }}>
                Ziel: {distDisplay}
            </div>
        </div>
    );
}
