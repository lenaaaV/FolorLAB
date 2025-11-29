import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Map from './components/Map';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Profile from './components/Profile';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('map');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <Login />;
  }

  return (
    <div className="App">
      <div className="content-area">
        {activeTab === 'map' && <Map session={session} />}

        {activeTab === 'collection' && (
          <div className="placeholder-view">
            <h2>Deine Sammlung</h2>
            <p>Hier siehst du bald deine gesammelten Momente.</p>
          </div>
        )}

        {activeTab === 'profile' && <Profile session={session} />}
      </div>

      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
