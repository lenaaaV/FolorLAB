import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import './Login.css';

export default function Login() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage('Registrierung erfolgreich! Bitte überprüfe deine E-Mails.');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = async () => {
        setLoading(true);
        setMessage('');
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: 'Spotly@demo.com',
                password: 'ISExGoogle',
            });
            if (error) throw error;
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <img src="/logo.png" alt="Folor" className="login-logo" />
                <p className="login-subtitle">Go outside. Touch some grass.</p>

                <form onSubmit={handleAuth} className="login-form">
                    <div className="input-group">
                        <input
                            type="email"
                            placeholder="E-Mail"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="login-input"
                        />
                    </div>
                    <div className="input-group">
                        <input
                            type="password"
                            placeholder="Passwort"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="login-input"
                        />
                    </div>

                    <button type="submit" disabled={loading} className="login-button">
                        {loading ? 'Laden...' : (isSignUp ? 'Registrieren' : 'Anmelden')}
                    </button>
                </form>

                <button
                    type="button"
                    onClick={handleDemoLogin}
                    className="demo-login-button"
                    disabled={loading}
                >
                    Demo Account
                </button>

                <p className="login-message" style={{ fontSize: '0.8rem', marginTop: '20px', lineHeight: '1.4' }}>
                    Bitte Standort aktivieren. Falls keine Karte angezeigt wird, bitte einen anderen Browser verwenden.
                </p>

                {message && <div className="login-message">{message}</div>}

                <div className="login-footer">
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setMessage('');
                        }}
                        className="toggle-auth-btn"
                    >
                        {isSignUp ? 'Bereits einen Account? Anmelden' : 'Noch keinen Account? Registrieren'}
                    </button>
                </div>
            </div>
        </div>
    );
}
