import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Map from './components/Map';
import StoryIntro from './components/Simulation/StoryIntro';
import ProfilingScreen from './components/Simulation/ProfilingScreen';
import ReactionTestScreen from './components/Simulation/ReactionTestScreen';
import MissionFog from './components/Simulation/MissionFog';
import MissionSecret from './components/Simulation/MissionSecret';
import MissionDeal from './components/Simulation/MissionDeal';
import MissionSocial from './components/Simulation/MissionSocial';
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
  // Flow: 'story' -> 'profiling' -> 'calibration' -> 'missions' -> 'experiment'
  const [simulationStep, setSimulationStep] = useState('story');
  const [activeProfileData, setActiveProfileData] = useState(null);

  // Mission Navigation State
  const [currentMissionIndex, setCurrentMissionIndex] = useState(0);
  const [missionDataStore, setMissionDataStore] = useState({});

  const [loading, setLoading] = useState(true);

  // Define Mission Sequence
  const MISSIONS = [
    // 1. Mission Fog (Existing)
    {
      id: 'fog_test',
      component: MissionFog,
      missionMode: {
        active: true,
        isVirtual: true,
        startPosition: [8.5500, 49.8600],
        target: [8.6560, 49.8750], // Uni/Home
        arrivalRadius: 50,
        missionId: 'fog_test'
      }
    },
    // 2. Mission Secret (New)
    {
      id: 'secret_board',
      component: MissionSecret,
      missionMode: {
        active: true,
        isVirtual: true,
        // Start where M1 ended (roughly)
        startPosition: [8.6560, 49.8750],
        target: [8.6580, 49.8760], // ~200m NE
        arrivalRadius: 50,
        missionId: 'secret_board'
      }
    },
    // 3. Mission Deal (New)
    {
      id: 'business_deal',
      component: MissionDeal,
      missionMode: {
        active: true,
        isVirtual: true,
        startPosition: [8.6580, 49.8760],
        target: [8.6550, 49.8740], // ~100m SW
        arrivalRadius: 50,
        missionId: 'business_deal'
      }
    },
    // 4. Mission Social (New)
    {
      id: 'social_proof',
      component: MissionSocial,
      missionMode: {
        active: true,
        isVirtual: true,
        startPosition: [8.6550, 49.8740],
        target: [8.6570, 49.8770], // ~300m N
        arrivalRadius: 50,
        missionId: 'social_proof'
      }
    }
  ];

  // Logic to handle Arrival Signals from Map
  // We need state to track if user is currently at target
  const [isAtTarget, setIsAtTarget] = useState(false);
  const [distanceToTarget, setDistanceToTarget] = useState(null);

  useEffect(() => {
    // Reset arrival state when mission changes
    setIsAtTarget(false);
    setDistanceToTarget(null);
  }, [currentMissionIndex]);

  const handleArrival = () => {
    if (!isAtTarget) {
      console.log("📍 Arrived at target!");
      setIsAtTarget(true);
    }
  };

  const handleDistanceUpdate = (dist) => {
    setDistanceToTarget(dist);
  };

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

    setSimulationStep('missions');
  };

  /**
   * Handle Mission Complete - Save to Supabase
   * Stores mission results in the simulation_results table
   * 
   * @param {Object} payload - Mission data with mission name and metrics
   */
  const handleMissionComplete = async (payload) => {
    console.log(`🏁 Mission ${currentMissionIndex + 1}/${MISSIONS.length} Complete:`, payload.mission);

    // 1. Save to Supabase (Robust)
    try {
      const { data, error } = await supabase
        .from('simulation_results')
        .insert({
          mission_name: payload.mission,
          metrics: payload,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      console.log('✅ Mission data saved to Supabase');
    } catch (error) {
      console.error('❌ Data Save Failed (Continuing flow anyway):', error.message);
    }

    // 2. Aggregate Data in State (for local usage/export)
    setMissionDataStore(prev => ({ ...prev, [payload.mission]: payload }));

    // 3. Navigate to Next Mission
    if (currentMissionIndex < MISSIONS.length - 1) {
      console.log("➡️ Advancing to next mission...");
      setCurrentMissionIndex(prev => prev + 1);
    } else {
      console.log('🎉 All Missions Complete!');
      handleAllMissionsDone();
    }
  };

  const handleAllMissionsDone = () => {
    // Determine final data
    const finalData = {
      ...activeProfileData,
      missions: missionDataStore,
      completed_at: new Date().toISOString()
    };

    // Auto-Download JSON
    downloadJson(finalData);

    // Switch to Experiment/Free Roam mode
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

  // 4. Mission Runner (Generic)
  if (simulationStep === 'missions') {
    const currentMissionConfig = MISSIONS[currentMissionIndex];
    if (!currentMissionConfig) return <div>Error: Mission Index Out of Bounds</div>;

    const MissionComponent = currentMissionConfig.component;

    return (
      <div className="App simulator-mode">
        <div className="simulation-status-bar">
          <div className="status-dot"></div>
          <span>Mission {currentMissionIndex + 1} / {MISSIONS.length}: {currentMissionConfig.id}</span>
        </div>
        <div className="content-area">
          <ErrorBoundary>
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {/* Render Map for ALL active missions */}
              {currentMissionConfig.missionMode?.active && (
                <Map
                  session={session}
                  appLoaded={appLoaded}
                  setAppLoaded={setAppLoaded}
                  missionMode={{
                    ...currentMissionConfig.missionMode,
                    // Pass callbacks
                    onComplete: handleMissionComplete,
                    onArrival: handleArrival,
                    onDistanceUpdate: handleDistanceUpdate
                  }}
                />
              )}

              {/* Render the Active Mission Component (Overlay) */}
              <MissionComponent
                onComplete={handleMissionComplete}
                isAtTarget={isAtTarget}
                distanceToTarget={distanceToTarget}
              />
            </div>
          </ErrorBoundary>
        </div>
      </div>
    );
  }


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
