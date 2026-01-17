import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Map from './components/Map';
import StoryIntro from './components/Simulation/StoryIntro';
import ProfilingScreen from './components/Simulation/ProfilingScreen';
import ReactionTestScreen from './components/Simulation/ReactionTestScreen';
import MissionFog from './components/Simulation/MissionFog';
import WelcomeScreen from './components/Simulation/WelcomeScreen'; // Keep for fallback imports
import './App.css';

// Simple Error Boundary for Debugging
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', textAlign: 'center', marginTop: '20vh' }}>
          <h2>Ein Fehler ist aufgetreten.</h2>
          <p>Bitte lade die Seite neu.</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: 10, color: '#333', opacity: 0.7 }}>
            {this.state.error && this.state.error.toString()}
          </details>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: 10 }}>Neu laden</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [session, setSession] = useState(null);
  const [appLoaded, setAppLoaded] = useState(false);

  // Simulation State
  // Flow: 'story' -> 'profiling' -> 'calibration' -> 'experiment'
  const [simulationStep, setSimulationStep] = useState('story');
  const [activeProfileData, setActiveProfileData] = useState(null);

  const [loading, setLoading] = useState(true);

  // Debug Logging
  useEffect(() => {
    console.log("App State Update - Step:", simulationStep, "Session:", session ? "Active" : "None");
  }, [simulationStep, session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleStoryComplete = () => {
    console.log("Story Complete -> Switching to Profiling");
    setSimulationStep('profiling');
  };

  const handleProfilingComplete = (profileData) => {
    console.log("Profiling Complete -> Switching to Calibration", profileData);
    setActiveProfileData(profileData);
    setSimulationStep('calibration');
  };

  const handleCalibrationComplete = async (reactionResults) => {
    console.log("Calibration Complete -> Logging in & Switching to Mission 1");

    // 1. Update Profile Logic
    setActiveProfileData(prev => ({
      ...prev,
      calibration: { reaction_test: reactionResults }
    }));

    // 2. Perform Login (Real or Mock) BEFORE Mission starts
    const testerId = activeProfileData?.tester_id || 'unknown';
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'Spotly@demo.com',
        password: 'ISExGoogle',
      });

      if (error) {
        console.warn("Real auth failed, using Mock Session:", error.message);
        setSession({
          user: { id: 'sim-user-' + testerId, email: 'test@sim.com' },
          access_token: 'mock-token'
        });
      }
    } catch (err) {
      setSession({
        user: { id: 'sim-user-' + testerId, email: 'test@sim.com' },
        access_token: 'mock-token'
      });
    }

    setSimulationStep('mission_1');
  };

  const handleMissionOneComplete = (missionData) => {
    console.log("Mission 1 Complete -> Exporting & Switching to Full Experiment");

    // 1. Aggregate Data (Profile + Calibration + Mission 1)
    const fullData = {
      ...activeProfileData,
      calibration: {
        reaction_test: activeProfileData.calibration.reaction_test
      },
      mission_1: missionData,
      completed_at: new Date().toISOString()
    };

    // 2. Download JSON
    const testerId = activeProfileData?.tester_id || 'unknown';

    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `folor_sim_${testerId}_session.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (e) {
      console.error("Download failed", e);
    }

    setSimulationStep('mission_2'); // Go to Mission 2 instead of Experiment
  };

  const handleMissionTwoComplete = (missionTwoData) => {
    console.log("Mission 2 Complete -> Exporting & Switching to Full Experiment");

    // 1. Aggregate Data (Profile + Calibration + Mission 1 + Mission 2)
    // Note: We need to assume mission_1 data is stored in state or merged here. 
    // Since we didn't save mission_1 data to state in handleMissionOneComplete (only logged it), 
    // we need to fix that first. 
    // ACTUALLY: Let's store mission 1 data in a state variable so we can aggregate it later.

    // REFACTOR: We need to save mission 1 data to state now.
    // See below for the state update pattern.
  };

  // State for aggregating mission data
  const [missionDataStore, setMissionDataStore] = useState({});

  const handleMissionOneData = (data) => {
    setMissionDataStore(prev => ({ ...prev, mission_1: data }));
    setSimulationStep('mission_2');
  };

  const handleMissionTwoData = (data) => {
    setMissionDataStore(prev => ({ ...prev, mission_2: data }));

    // NOW we finalize
    const finalData = {
      ...activeProfileData,
      calibration: activeProfileData?.calibration || {},
      mission_1: missionDataStore.mission_1, // From State
      mission_2: data, // Current
      completed_at: new Date().toISOString()
    };

    downloadJson(finalData);
    setSimulationStep('experiment');
  };

  const downloadJson = (data) => {
    const testerId = activeProfileData?.tester_id || 'unknown';
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `folor_sim_${testerId}_session.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>; // Visible loading state
  }

  // --- RENDER LOGIC for SIMULATOR ---

  // 1. Story Intro
  if (simulationStep === 'story') {
    return <StoryIntro onComplete={handleStoryComplete} />;
  }

  // 2. Profiling Phase (Check-In)
  if (simulationStep === 'profiling') {
    return (
      <ErrorBoundary>
        <ProfilingScreen onComplete={handleProfilingComplete} />
      </ErrorBoundary>
    );
  }

  // 3. Calibration Phase (Reaction)
  if (simulationStep === 'calibration') {
    return <ReactionTestScreen onComplete={handleCalibrationComplete} />;
  }

  // 4. Mission 1: Fog of Curiosity (Virtual Walk)
  if (simulationStep === 'mission_1') {
    return (
      <div className="App simulator-mode">
        <div className="simulation-status-bar">
          <div className="status-dot"></div>
          <span>Mission: Fog of Curiosity</span>
        </div>
        <div className="content-area">
          <ErrorBoundary>
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <Map
                session={session}
                appLoaded={appLoaded}
                setAppLoaded={setAppLoaded}
                missionMode={{
                  active: true,
                  isVirtual: true,
                  // Much further away (Griesheim West) - approx 6-7km
                  startPosition: [8.5500, 49.8600],
                  missionId: 'fog_test'
                }}
              />
              <MissionFog onComplete={handleMissionOneData} />
            </div>
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  // 5. Mission 2: Clutter Test
  if (simulationStep === 'mission_2') {
    return (
      <div className="App simulator-mode">
        <div className="simulation-status-bar">
          <div className="status-dot"></div>
          <span>Mission: Focus</span>
        </div>
        <div className="content-area">
          <ErrorBoundary>
            <Map
              session={session}
              appLoaded={appLoaded}
              setAppLoaded={setAppLoaded}
              missionMode={{
                active: true,
                missionId: '2_clutter',
                onOutcome: handleMissionTwoData
              }}
            />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  // 6. Experiment Phase (Map + Missions)
  // If session exists OR explicit experiment step (priority to experiment flow)
  if (session || simulationStep === 'experiment') {
    return (
      <div className="App simulator-mode">
        {/* Simulation Status Overlay */}
        <div className="simulation-status-bar">
          <div className="status-dot"></div>
          <span>Mission: Explore</span>
        </div>

        <div className="content-area">
          <ErrorBoundary>
            <Map session={session} appLoaded={appLoaded} setAppLoaded={setAppLoaded} />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  // Fallback
  return <StoryIntro onComplete={handleStoryComplete} />;
}

export default App;
