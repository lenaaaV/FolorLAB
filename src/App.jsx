import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Map from './components/Map';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Profile from './components/Profile';
import Collection from './components/Collection';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [appLoaded, setAppLoaded] = useState(false);

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
        {activeTab === 'map' && <Map session={session} appLoaded={appLoaded} setAppLoaded={setAppLoaded} />}

        {activeTab === 'collection' && <Collection session={session} />}

        {activeTab === 'profile' && <Profile session={session} />}
      </div>

      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
