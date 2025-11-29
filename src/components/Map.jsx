import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './Map.css';
import MemoryBoard from './MemoryBoard';
import LoadingScreen from './LoadingScreen';

import { supabase } from '../supabaseClient';

export default function Map({ session }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const userMarker = useRef(null);
  const canvasRef = useRef(null);
  const [lng, setLng] = useState(null);
  const [lat, setLat] = useState(null);
  const [zoom] = useState(15);
  const [visitedPoints, setVisitedPoints] = useState([]);
  const [dbPointsLoaded, setDbPointsLoaded] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoading, setShowLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Satelliten werden poliert...");
  const [showInfo, setShowInfo] = useState(false);
  // Profile state removed (handled by Navbar)

  // Address Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  // Memory Board State
  const [showBoard, setShowBoard] = useState(false);

  const API_KEY = 'bkYozeqRKy60GSaYe5j9';
  const FOG_RADIUS_METERS = 200;
  const TU_DARMSTADT = [8.6512, 49.8728];

  const loadingMessages = [
    "Satelliten werden poliert...",
    "Karte wird gebügelt...",
    "GPS-Signale werden eingefangen...",
    "Nebel wird erzeugt...",
    "Kompass wird kalibriert..."
  ];

  // Helper to get pixel radius from meters
  const getPixelRadius = (latitude) => {
    if (!map.current) return 0;
    const metersPerPixel = 40075016.686 * Math.abs(Math.cos(latitude * Math.PI / 180)) / Math.pow(2, map.current.getZoom() + 8);
    return FOG_RADIUS_METERS / metersPerPixel;
  };

  // Function to draw the fog
  const drawFog = () => {
    const canvas = canvasRef.current;
    if (!canvas || !map.current) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const width = mapContainer.current.clientWidth;
    const height = mapContainer.current.clientHeight;

    // Resize canvas if needed (debounced slightly by RAF nature, but good to check)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Clear entire canvas
    ctx.clearRect(0, 0, width, height);

    // Draw semi-transparent white fog background
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; // White fog
    ctx.fillRect(0, 0, width, height);

    // Set composite operation to 'destination-out' to "erase" the fog
    ctx.globalCompositeOperation = 'destination-out';

    const bounds = map.current.getBounds();
    // Add some padding to bounds to ensure circles on the edge are drawn
    // 0.01 degrees is roughly 1km, sufficient for 200m radius
    const padding = 0.01;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Helper to draw a hole
    const drawHole = (lng, lat) => {
      // Viewport culling: simple bounding box check
      if (lng < sw.lng - padding || lng > ne.lng + padding ||
        lat < sw.lat - padding || lat > ne.lat + padding) {
        return;
      }

      const { x, y } = map.current.project([lng, lat]);

      // Ensure radius is at least 1px to avoid disappearing at low zooms
      const radius = Math.max(getPixelRadius(lat), 1);

      const gradient = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    // Draw user location hole
    if (userMarker.current) {
      const pos = userMarker.current.getLngLat();
      drawHole(pos.lng, pos.lat);
    }

    // Draw visited points holes
    visitedPoints.forEach(point => {
      drawHole(point.lng, point.lat);
    });
  };

  // RAF Loop for smooth animation
  useEffect(() => {
    let animationFrameId;

    const render = () => {
      drawFog();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [visitedPoints, hasLocation]); // Re-bind when points change

  const handleRecenter = () => {
    setIsFollowing(true);
    if (map.current && lng && lat) {
      map.current.flyTo({
        center: [lng, lat],
        zoom: 16,
        speed: 1.5,
        curve: 1,
        easing: (t) => t
      });
    }
  };

  const handleSearch = async (query) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    try {
      const response = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${API_KEY}`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        setSearchResults(data.features);
        setShowResults(true);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleSelectLocation = (result) => {
    const [lng, lat] = result.center;

    if (map.current) {
      map.current.flyTo({
        center: [lng, lat],
        zoom: 16,
        speed: 1.5,
        curve: 1,
        easing: (t) => t
      });
    }

    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setIsFollowing(false);
  };



  // Loading screen logic
  useEffect(() => {
    const startTime = Date.now();
    const duration = 5000; // 5 seconds

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setLoadingProgress(progress);

      // Change text every 20%
      const messageIndex = Math.floor((progress / 100) * loadingMessages.length);
      if (loadingMessages[messageIndex]) {
        setLoadingText(loadingMessages[messageIndex]);
      }

      if (progress >= 100) {
        clearInterval(interval);
        // Only hide loading if we also have location
        if (hasLocation) {
          setTimeout(() => {
            setShowLoading(false);
            setShowInfo(true); // Show info popup after loading
          }, 500);
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [hasLocation]);

  // Safety timeout: Force hide loading screen after 10 seconds if location fails
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (showLoading) {
        setShowLoading(false);
        if (!hasLocation) {
          // Fallback to Berlin if location timed out
          setLng(13.405);
          setLat(52.52);
          setHasLocation(true);
        }
        setShowInfo(true);
      }
    }, 10000);

    return () => clearTimeout(safetyTimeout);
  }, [showLoading, hasLocation]);

  // Ensure loading screen hides when both timer is done and location is found
  useEffect(() => {
    if (loadingProgress >= 100 && hasLocation) {
      setTimeout(() => {
        setShowLoading(false);
        setShowInfo(true); // Show info popup after loading
      }, 500);
    }
  }, [hasLocation, loadingProgress]);


  // --- Map Initialization Logic ---
  const initMap = (longitude, latitude) => {
    if (map.current) return; // Map already initialized

    console.log("Initializing map at:", longitude, latitude);

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: `https://api.maptiler.com/maps/019ab162-cdfb-71a2-ac7c-5b04b94ab23f/style.json?key=4SKAZ4ymtxurSp8vqiLa`,
        center: [longitude, latitude],
        zoom: zoom
      });

      map.current.on('load', () => {
        console.log("Map loaded successfully");
        // Force a resize to ensure correct rendering
        map.current.resize();
      });

      map.current.on('error', (e) => {
        console.error("Map error:", e);
      });



      const stopFollowing = () => setIsFollowing(false);
      map.current.on('dragstart', stopFollowing);
      map.current.on('touchstart', stopFollowing);
      map.current.on('wheel', stopFollowing);

      // User Marker
      const el = document.createElement('div');
      el.className = 'user-marker';
      userMarker.current = new maplibregl.Marker({ element: el })
        .setLngLat([longitude, latitude])
        .addTo(map.current);

      // Memory Board Marker (TU Darmstadt)
      const boardContainer = document.createElement('div');
      boardContainer.className = 'board-marker-container';

      const boardEl = document.createElement('div');
      boardEl.className = 'board-marker';
      boardEl.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>';
      boardEl.onclick = (e) => {
        e.stopPropagation();
        setShowBoard(true);
      };

      boardContainer.appendChild(boardEl);

      new maplibregl.Marker({ element: boardContainer })
        .setLngLat(TU_DARMSTADT)
        .addTo(map.current);

    } catch (error) {
      console.error("Error initializing map:", error);
    }
  };

  useEffect(() => {
    // 1. Try Geolocation
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          console.log("Geolocation success:", longitude, latitude);

          if (!hasLocation) {
            setLng(longitude);
            setLat(latitude);
            setHasLocation(true);
            // Initialize map if not already done
            initMap(longitude, latitude);
          } else {
            // Update state and marker
            setLng(longitude);
            setLat(latitude);
            if (userMarker.current) {
              userMarker.current.setLngLat([longitude, latitude]);
            }
            if (map.current && isFollowing) {
              map.current.flyTo({
                center: [longitude, latitude],
                zoom: 16,
                speed: 1.5,
                curve: 1,
                easing: (t) => t
              });
            }
          }

          // Update visited points logic
          setVisitedPoints(prev => {
            const lastPoint = prev[prev.length - 1];
            if (lastPoint) {
              const dist = Math.sqrt(Math.pow(lastPoint.lng - longitude, 2) + Math.pow(lastPoint.lat - latitude, 2));
              if (dist < 0.0001) return prev;
            }
            return [...prev, { lng: longitude, lat: latitude }];
          });
        },
        (error) => {
          console.warn('Geolocation error:', error);
          // Don't init map here, let the safety timeout handle it to avoid race conditions
          // or double initialization if it eventually succeeds.
          // But if we already have a map (fallback), just log it.
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      console.warn('Geolocation not supported');
      // Fallback handled by safety timeout
    }
  }, [API_KEY, zoom, hasLocation, isFollowing]);

  // 2. Safety Timeout (Fallback)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!map.current) {
        console.warn("Map not initialized after timeout. Using fallback location.");
        setLng(TU_DARMSTADT[0]);
        setLat(TU_DARMSTADT[1]);
        setHasLocation(true);
        initMap(TU_DARMSTADT[0], TU_DARMSTADT[1]);
      }
    }, 2000); // 2 seconds timeout

    return () => clearTimeout(timer);
  }, []);

  // Load visited points from Supabase
  useEffect(() => {
    if (session?.user?.id) {
      const fetchPoints = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('visited_points')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error('Error fetching points:', error);
        } else if (data && data.visited_points) {
          setVisitedPoints(data.visited_points);
        }
        setDbPointsLoaded(true);
      };
      fetchPoints();
    }
  }, [session]);

  // Save visited points to Supabase (debounced)
  useEffect(() => {
    if (!session?.user?.id || !dbPointsLoaded) return;

    const savePoints = async () => {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          visited_points: visitedPoints,
          updated_at: new Date()
        });

      if (error) {
        console.error('Error saving points:', error);
      }
    };

    // Save every 5 seconds or when points change significantly
    const timeoutId = setTimeout(savePoints, 5000);
    return () => clearTimeout(timeoutId);
  }, [visitedPoints, session, dbPointsLoaded]);

  // useEffect(() => {
  //   drawFog();
  // }, [visitedPoints]); // Handled by RAF

  // --- Onboarding Logic ---
  const [onboardingStep, setOnboardingStep] = useState(0); // 0 = inactive, 1-4 = active steps

  // Helper to get screen coordinates for spotlight
  const getSpotlightStyle = () => {
    if (!map.current || onboardingStep === 0) return {};

    let targetLng, targetLat;

    if (onboardingStep >= 1 && onboardingStep <= 3) {
      // User location (Steps 1, 2, 3)
      if (userMarker.current) {
        const pos = userMarker.current.getLngLat();
        targetLng = pos.lng;
        targetLat = pos.lat;
      }
    } else if (onboardingStep >= 4 && onboardingStep <= 6) {
      // Memory Board location (Steps 4, 5, 6)
      targetLng = TU_DARMSTADT[0];
      targetLat = TU_DARMSTADT[1];
    }

    if (targetLng && targetLat) {
      const point = map.current.project([targetLng, targetLat]);
      return {
        '--spotlight-x': `${point.x}px`,
        '--spotlight-y': `${point.y}px`
      };
    }
    return {};
  };

  // Handle Onboarding Transitions
  useEffect(() => {
    if (!map.current) return;

    if (onboardingStep === 1) {
      // Step 1: Zoom to user
      if (userMarker.current) {
        const pos = userMarker.current.getLngLat();
        map.current.flyTo({
          center: pos,
          zoom: 17,
          duration: 1500,
          essential: true
        });
      }
    } else if (onboardingStep === 4) {
      // Step 4: Pan to Memory Board
      setIsFollowing(false); // Stop following user location
      map.current.flyTo({
        center: TU_DARMSTADT,
        zoom: 17,
        duration: 1500,
        essential: true
      });
    }
  }, [onboardingStep]);

  const startOnboarding = () => {
    setShowInfo(false);
    setOnboardingStep(1);
  };

  const nextOnboardingStep = () => {
    if (onboardingStep < 6) {
      setOnboardingStep(prev => prev + 1);
    } else {
      setOnboardingStep(0); // Finish

      // Fly back to user location
      if (userMarker.current && map.current) {
        const pos = userMarker.current.getLngLat();
        map.current.flyTo({
          center: pos,
          zoom: 16,
          duration: 1500,
          essential: true
        });
        setIsFollowing(true);
      }
    }
  };


  return (
    <div className="map-wrap">
      {showLoading && (
        <LoadingScreen text={loadingText} progress={loadingProgress} />
      )}

      {showInfo && (
        <div className="info-modal-overlay">
          <div className="info-modal">
            <div className="info-scroll-content">
              <h2>Willkommen bei Folor</h2>
              <p className="info-intro">
                Erkunde deine Umgebung und entdecke verborgene Orte. Der Nebel lichtet sich genau dort, wo du dich befindest – und die Welt um dich herum wird lebendig.
              </p>

              <div className="info-steps">
                <div className="info-step">
                  <span className="step-number">1</span>
                  <div className="step-content">
                    <h2>Bewege dich durch die Karte</h2>
                    <p>Alles beginnt dunkel. Sobald du dich an einem Ort befindest, wird dieser farbig sichtbar – du „enthüllst“ die Welt Schritt für Schritt.</p>
                  </div>
                </div>

                <div className="info-step">
                  <span className="step-number">2</span>
                  <div className="step-content">
                    <h2>Entdecke Memory Boards</h2>
                    <p>An jedem freigeschalteten Ort findest du ein Memory Board mit Audio, Fotos, Videos und Texten. Hier erzählen Menschen ihre Geschichten.</p>
                  </div>
                </div>

                <div className="info-step">
                  <span className="step-number">3</span>
                  <div className="step-content">
                    <h2>Hinterlasse deine eigene Spur</h2>
                    <p>Warst du schon einmal hier? Füge dein eigenes Memory hinzu und werde Teil der Geschichte des Ortes.</p>
                  </div>
                </div>

                <div className="info-step">
                  <span className="step-number">4</span>
                  <div className="step-content">
                    <h2>Sammle Spots</h2>
                    <p>Je mehr Orte du entdeckst, desto größer wird deine persönliche, farbig leuchtende Karte.</p>
                  </div>


                </div>

                <div className="info-step">
                  <span className="step-number">5</span>
                  <div className="step-content">
                    <h2>Wichtig: Standort & Browser</h2>
                    <p>Bitte erlaube den Zugriff auf deinen Standort. Falls keine Karte angezeigt wird, versuche es bitte mit einem anderen Browser.</p>
                  </div>
                </div>

                <div className="info-step">
                  <span className="step-number">6</span>
                  <div className="step-content">
                    <h2>Disclaimer</h2>
                    <p>Du erlebst gerade den Anfang unserer Reise (Clickable MVP). Wir entwickeln Folor ständig weiter und neue Features sind bereits in Arbeit. Aktuell wartet das erste Memory Board in Darmstadt an der TU Uni darauf, von dir entdeckt zu werden.</p>
                  </div>
                </div>
              </div>
            </div>


            <div className="info-footer">
              <button className="info-close-btn" onClick={startOnboarding}>Verstanden</button>
            </div>
          </div>
        </div>

      )}



      {showBoard && (
        <MemoryBoard
          onClose={() => setShowBoard(false)}
          locationName="TU Darmstadt"
          locationImage="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1000"
        />
      )}

      <div ref={mapContainer} className="map" />
      <canvas ref={canvasRef} className="fog-overlay" />

      {/* Address Search Bar */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Adresse suchen..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearch(e.target.value);
            }}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowResults(false);
              }}
            >
              ×
            </button>
          )}
        </div>

        {showResults && searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="search-result-item"
                onClick={() => handleSelectLocation(result)}
              >
                <svg className="result-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <div className="result-text">
                  <div className="result-name">{result.text || result.place_name}</div>
                  {result.place_name && result.text !== result.place_name && (
                    <div className="result-address">{result.place_name}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>



      <div className="controls-container">
        <button className="info-trigger-btn" onClick={() => setShowInfo(true)}>
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </button>

        {!isFollowing && (
          <button className="recenter-btn" onClick={handleRecenter}>
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
            </svg>
          </button>
        )}
      </div>

      {/* Onboarding Overlay */}
      {onboardingStep > 0 && (
        <div className={`onboarding-overlay step-${onboardingStep}`} style={getSpotlightStyle()}>
          <div className="spotlight-mask"></div>

          <div className="onboarding-content">
            {onboardingStep === 1 && (
              <div className="onboarding-card">
                <h2>Hier befindest du dich gerade.</h2>
                <button className="onboarding-btn" onClick={nextOnboardingStep}>Weiter</button>
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="onboarding-card">
                <h2>Deine Umgebung liegt im Nebel.</h2>
                <button className="onboarding-btn" onClick={nextOnboardingStep}>Weiter</button>
              </div>
            )}

            {onboardingStep === 3 && (
              <div className="onboarding-card">
                <h2>Jeder Schritt färbt deine Welt.</h2>
                <button className="onboarding-btn" onClick={nextOnboardingStep}>Weiter</button>
              </div>
            )}

            {onboardingStep === 4 && (
              <div className="onboarding-card">
                <h2>Finde Memory Boards.</h2>
                <button className="onboarding-btn" onClick={nextOnboardingStep}>Weiter</button>
              </div>
            )}

            {onboardingStep === 5 && (
              <div className="onboarding-card">
                <h2>Entdecke mehr. Erschaffe Neues.</h2>
                <button className="onboarding-btn" onClick={nextOnboardingStep}>Weiter</button>
              </div>
            )}

            {onboardingStep === 6 && (
              <div className="onboarding-card">
                <h2>Exklusive Inhalte nur vor Ort.</h2>
                <button className="onboarding-btn" onClick={nextOnboardingStep}>Verstanden</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div >
  );
}
