import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './Map.css';
import MemoryBoard, { TargetIndicator } from './MemoryBoard';
import LoadingScreen from './LoadingScreen';

import { supabase } from '../supabaseClient';
import { calculateLevel } from '../utils/levelLogic';
import LevelIndicator from './LevelIndicator';

import ChallengesModal from './ChallengesModal';
import { MEMORY_BOARD_LOCATIONS } from '../constants';
import { fetchPlacesInBounds } from '../utils/overpass';
import { generateBoardsForPlace } from '../utils/boardGenerator';

export default function Map({ session, appLoaded, setAppLoaded, missionMode }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const userMarker = useRef(null);
  const canvasRef = useRef(null);
  const [lng, setLng] = useState(null);
  const [lat, setLat] = useState(null);
  const [zoom] = useState(15);
  const [visitedPoints, setVisitedPoints] = useState([]);
  const visitedPointsRef = useRef([]); // Ref for performance optimization
  const [dbPointsLoaded, setDbPointsLoaded] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);

  // Virtual Movement State
  const [virtualPos, setVirtualPos] = useState(null); // { lng, lat }
  const [isWalking, setIsWalking] = useState(false);
  const animationRef = useRef(null);
  const routeCoordsRef = useRef(null);
  // --- MYSTERY GLOWS (Curiosity Test) ---
  const mysteryPointsRef = useRef([]); // [{lng, lat, found: false, id: 1}]

  // Generate Mystery Points along the path (approximate corridor)
  const generateMysteryPoints = (startLng, startLat) => {
    const points = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      // Create points somewhat randomly in the general direction of the goal but off-path
      // Direction is roughly East-North-East
      const progress = (i + 1) / (count + 2); // Spread them out
      const baseLng = startLng + (8.6560 - startLng) * progress;
      const baseLat = startLat + (49.8750 - startLat) * progress;

      // Add random deviation (approx 200-500m off-track)
      const devLat = (Math.random() - 0.5) * 0.008;
      const devLng = (Math.random() - 0.5) * 0.008;

      points.push({
        id: i,
        lng: baseLng + devLng,
        lat: baseLat + devLat,
        found: false
      });
    }
    // Add one very close to start to ensure visibility immediately
    points.push({
      id: 99,
      lng: startLng + 0.002, // Just slightly East
      lat: startLat + 0.001, // Slightly North
      found: false
    });

    mysteryPointsRef.current = points;
  };
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoading, setShowLoading] = useState(!appLoaded);
  const [loadingText, setLoadingText] = useState("Satelliten werden poliert...");
  const [showInfo, setShowInfo] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);

  // Level System State
  const [levelData, setLevelData] = useState({
    level: 1,
    currentXP: 0,
    nextLevelXP: 1000,
    progress: 0
  });

  // Address Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  // Memory Board State
  const [showBoard, setShowBoard] = useState(null);
  const [generatedBoards, setGeneratedBoards] = useState([]);
  const [processedPlaceIds, setProcessedPlaceIds] = useState(new Set());

  const API_KEY = 'bkYozeqRKy60GSaYe5j9';
  const FOG_RADIUS_METERS = 200;
  const TU_DARMSTADT = [8.6512, 49.8728]; // Keep for onboarding fallback if needed


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

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Fog Background
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Route ON TOP of Fog
    if (routeCoordsRef.current) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#e74c3c'; // Red
      ctx.setLineDash([10, 10]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'white';
      ctx.shadowBlur = 5;

      ctx.beginPath();
      let first = true;
      routeCoordsRef.current.forEach(coord => {
        const { x, y } = map.current.project(coord);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Reset styles
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }


    // --- DRAW MYSTERY GLOWS (In the fog) ---
    // These should appear "under" the fog or "in" it.
    // Since we draw white fog over everything, drawing COLORED glows *before* the destination-out
    // efficiently makes them look like they are glowing *on* the white fog if we draw them 
    // using source-over BUT with a semi-transparent colored gradient.

    // Actually, to make them invisible *unless* near but visible *as glows*,
    // let's draw them ON TOP of the white fog with a nice pulse.

    const now = Date.now();
    const pulse = (Math.sin(now / 500) + 1) / 2; // 0 to 1 oscillating
    const glowRadiusBase = 20;

    mysteryPointsRef.current.forEach(point => {
      if (point.found) return; // Don't show if found/collected? Or maybe show differently?

      const { x, y } = map.current.project([point.lng, point.lat]);

      // Culling
      if (x < -50 || x > width + 50 || y < -50 || y > height + 50) return;

      // Draw Glow
      const r = glowRadiusBase + (pulse * 10);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
      grad.addColorStop(0, 'rgba(255, 215, 0, 0.8)'); // Gold/Yellow center
      grad.addColorStop(0.5, 'rgba(255, 165, 0, 0.3)'); // Orange mid
      grad.addColorStop(1, 'rgba(255, 165, 0, 0)'); // Fade out

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r * 2, 0, Math.PI * 2);
      ctx.fill();

      // Add a "Question Mark" or symbol?
      // Maybe just the glow is more mysterious (User said "iwo verstecken")
    });

    // 3. Cut Holes
    ctx.globalCompositeOperation = 'destination-out';

    const bounds = map.current.getBounds();
    const padding = 0.01;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const drawHole = (lng, lat, radiusMultiplier = 1) => {
      if (lng < sw.lng - padding || lng > ne.lng + padding ||
        lat < sw.lat - padding || lat > ne.lat + padding) {
        return;
      }

      const { x, y } = map.current.project([lng, lat]);
      const radius = Math.max(getPixelRadius(lat) * radiusMultiplier, 1);

      const gradient = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    if (userMarker.current) {
      const pos = userMarker.current.getLngLat();
      drawHole(pos.lng, pos.lat);
    }

    visitedPointsRef.current.forEach(point => {
      drawHole(point.lng, point.lat);
    });
  };

  // --- Route Rendering Logic ---
  const drawRoute = async (startLng, startLat, endLng, endLat) => {
    if (!map.current) return;

    try {
      const url = `https://api.maptiler.com/directions/walking/${startLng},${startLat};${endLng},${endLat}?key=${API_KEY}&geometries=geojson&overview=full`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0].geometry;

        if (route.type === 'LineString') {
          routeCoordsRef.current = route.coordinates;
        }

        if (map.current.getSource('route')) {
          map.current.getSource('route').setData(route);
        } else {
          map.current.addSource('route', {
            type: 'geojson',
            data: route
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#e74c3c',
              'line-width': 5,
              'line-opacity': 0.7,
              'line-dasharray': [2, 1]
            }
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch route:", error);
    }
  };

  // --- Virtual Walking Logic ---
  const walkTo = (targetLng, targetLat) => {
    if (!missionMode?.isVirtual || isWalking) return;

    const startLng = virtualPos ? virtualPos.lng : lng;
    const startLat = virtualPos ? virtualPos.lat : lat;

    // Calculate distance
    const R = 6371e3; // Earth radius in meters
    const phi1 = startLat * Math.PI / 180;
    const phi2 = targetLat * Math.PI / 180;
    const dPhi = (targetLat - startLat) * Math.PI / 180;
    const dLambda = (targetLng - startLng) * Math.PI / 180;

    const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;

    // Speed: 15 km/h (fast walk/jog for simulation feel) = ~4.1 m/s
    // Real walking is too slow for patience, so we speed it up slightly
    const speed = 250; // meters per second (Simulation Speed)
    const duration = (dist / speed) * 1000;

    const startTime = Date.now();
    setIsWalking(true);

    const animateWalk = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Lerp
      const currentLng = startLng + (targetLng - startLng) * progress;
      const currentLat = startLat + (targetLat - startLat) * progress;

      setVirtualPos({ lng: currentLng, lat: currentLat });

      // Update Marker
      if (userMarker.current) {
        userMarker.current.setLngLat([currentLng, currentLat]);
      }

      // Update Fog & Visited
      setLat(currentLat);
      setLng(currentLng);
      // We manually trigger fog redraw via RAF loop reading these value, 
      // but visited points need update to clear path
      setVisitedPoints(prev => {
        const lastPoint = prev[prev.length - 1];
        if (lastPoint) {
          const d = Math.sqrt(Math.pow(lastPoint.lng - currentLng, 2) + Math.pow(lastPoint.lat - currentLat, 2));
          if (d < 0.00005) return prev; // Filter close points
        }
        const newPoints = [...prev, { lng: currentLng, lat: currentLat }];
        visitedPointsRef.current = newPoints;
        return newPoints;
      });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animateWalk);
      } else {
        setIsWalking(false);
      }
    };

    animationRef.current = requestAnimationFrame(animateWalk);
  };

  // Click Listener for Virtual Walk
  useEffect(() => {
    if (!map.current || !missionMode?.isVirtual) return;

    const handleClick = (e) => {
      walkTo(e.lngLat.lng, e.lngLat.lat);
    };

    map.current.on('click', handleClick);
    // Change cursor
    map.current.getCanvas().style.cursor = 'crosshair';

    return () => {
      if (map.current) {
        map.current.off('click', handleClick);
        map.current.getCanvas().style.cursor = '';
      }
    };
  }, [missionMode, virtualPos, isWalking, lng, lat]);


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
  }, [hasLocation]); // Removed visitedPoints dependency to prevent loop restart

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
    if (appLoaded) return;

    const startTime = Date.now();
    const duration = 3000; // 3 seconds

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
            setAppLoaded(true);
            setShowInfo(true); // Show info popup after loading
          }, 500);
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [hasLocation, appLoaded]);

  // Safety timeout: Force hide loading screen after 10 seconds if location fails
  useEffect(() => {
    if (appLoaded) return;

    const safetyTimeout = setTimeout(() => {
      if (showLoading) {
        setShowLoading(false);
        if (!hasLocation) {
          // Fallback to Berlin if location timed out
          setLng(13.405);
          setLat(52.52);
          setHasLocation(true);
        }
        setAppLoaded(true);
        setShowInfo(true);
      }
    }, 10000);

    return () => clearTimeout(safetyTimeout);
  }, [showLoading, hasLocation, appLoaded]);

  // Ensure loading screen hides when both timer is done and location is found
  useEffect(() => {
    if (loadingProgress >= 100 && hasLocation && !appLoaded) {
      setTimeout(() => {
        setShowLoading(false);
        setAppLoaded(true);
        setShowInfo(true); // Show info popup after loading
      }, 500);
    }
  }, [hasLocation, loadingProgress, appLoaded]);


  // --- Map Initialization Logic ---
  const initMap = (longitude, latitude) => {
    if (map.current) return; // Map already initialized

    console.log("Initializing map at:", longitude, latitude);

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: `https://api.maptiler.com/maps/019ab162-cdfb-71a2-ac7c-5b04b94ab23f/style.json?key=4SKAZ4ymtxurSp8vqiLa`,
        center: [longitude, latitude],
        zoom: zoom,
        attributionControl: false // Disable default attribution to move it
      });

      // Add attribution to bottom-right
      map.current.addControl(new maplibregl.AttributionControl({
        compact: false
      }), 'bottom-right');

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

      // Dynamic Board Generation on Move - REMOVED per user request (Darmstadt & Frankfurt only)
      /*
      map.current.on('moveend', async () => {
        if (!map.current) return;
   
        const bounds = map.current.getBounds();
        const zoom = map.current.getZoom();
   
        // Only fetch if zoomed in enough to avoid fetching whole country
        if (zoom > 10) {
          const { places, pois } = await fetchPlacesInBounds(bounds);
   
          const newBoards = [];
          const newProcessedIds = new Set(processedPlaceIds);
   
          places.forEach(place => {
            if (!newProcessedIds.has(place.id)) {
              const boards = generateBoardsForPlace(place, pois);
              newBoards.push(...boards);
              newProcessedIds.add(place.id);
            }
          });
   
          if (newBoards.length > 0) {
            setGeneratedBoards(prev => [...prev, ...newBoards]);
            setProcessedPlaceIds(newProcessedIds);
          }
        }
      });
      */

      // User Marker
      const el = document.createElement('div');
      el.className = 'user-marker';
      userMarker.current = new maplibregl.Marker({ element: el })
        .setLngLat([longitude, latitude])
        .addTo(map.current);

      // Dynamic Memory Board Markers
      /*
      MEMORY_BOARD_LOCATIONS.forEach(location => {
        const container = document.createElement('div');
        container.className = 'board-marker-container';
   
        const el = document.createElement('div');
        el.className = 'board-marker';
   
        // Custom style for ISE x Google to keep it blue
        const leafStyle = location.name === 'ISE x Google' ? 'background: #4285F4;' : '';
   
        el.innerHTML = `
          <div class="board-icon-wrapper">
            <div class="board-leaf" style="${leafStyle}"></div>
            <div class="board-body">
              <div class="board-content-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
            </div>
            <div class="board-post"></div>
          </div>
        `;
   
        el.onclick = (e) => {
          e.stopPropagation();
          setShowBoard({
            name: location.name,
            image: location.image
          });
        };
   
        container.appendChild(el);
   
        new maplibregl.Marker({ element: container })
          .setLngLat(location.coordinates)
          .addTo(map.current);
      });
      */
    } catch (error) {
      console.error("Error initializing map:", error);
    }
  };

  // Render generated boards
  /*
  useEffect(() => {
    if (!map.current || generatedBoards.length === 0) return;
   
    generatedBoards.forEach(board => {
      // Check if marker already exists to avoid duplicates (though state check helps)
      // For now, simple add. In production, we'd track marker instances to remove them if needed.
   
      const container = document.createElement('div');
      container.className = 'board-marker-container';
   
      const el = document.createElement('div');
      el.className = 'board-marker';
   
      el.innerHTML = `
          <div class="board-icon-wrapper">
            <div class="board-leaf" style="background: #a29bfe;"></div>
            <div class="board-body">
              <div class="board-content-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
            </div>
            <div class="board-post"></div>
          </div>
        `;
   
      el.onclick = (e) => {
        e.stopPropagation();
        setShowBoard({
          name: board.name,
          image: board.image
        });
      };
   
      container.appendChild(el);
   
      new maplibregl.Marker({ element: container })
        .setLngLat(board.coordinates)
        .addTo(map.current);
    });
  }, [generatedBoards]);
  */

  useEffect(() => {
    // 0. VIRTUAL MODE (Override Geolocation)
    if (missionMode?.isVirtual) {
      if (!hasLocation && missionMode.startPosition) {
        const [startLng, startLat] = missionMode.startPosition;
        generateMysteryPoints(startLng, startLat);
        setLng(startLng);
        setLat(startLat);
        setVirtualPos({ lng: startLng, lat: startLat });
        setHasLocation(true);
        initMap(startLng, startLat);
        setVirtualPos({ lng: startLng, lat: startLat });
        setHasLocation(true);
        initMap(startLng, startLat);

        // Draw route to Uni/Home if in Fog Mission
        if (missionMode.missionId === 'fog_test') {
          // Wait a bit for map to init
          setTimeout(() => {
            // Add "Home/Uni" Marker
            const el = document.createElement('div');
            el.className = 'mission-target-marker';
            el.style.background = 'white';
            el.style.width = '40px';
            el.style.height = '40px';
            el.style.borderRadius = '50%';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
            el.innerHTML = '<span style="font-size:24px;">🎓</span>';

            new maplibregl.Marker({ element: el })
              .setLngLat([8.6560, 49.8750])
              .addTo(map.current);

            drawRoute(startLng, startLat, 8.6560, 49.8750);
          }, 1000);
        }
      }
      return; // Skip real geolocation
    }

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
            const newPoints = [...prev, { lng: longitude, lat: latitude }];
            visitedPointsRef.current = newPoints; // Update ref
            return newPoints;
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

  // --- GENERIC TARGET DETECTION (New Missions) ---
  useEffect(() => {
    if (!missionMode?.target || !lat || !lng) return;

    const [targetLng, targetLat] = missionMode.target;

    // Dist calc
    const R = 6371e3;
    const phi1 = lat * Math.PI / 180;
    const phi2 = targetLat * Math.PI / 180;
    const dPhi = (targetLat - lat) * Math.PI / 180;
    const dLambda = (targetLng - lng) * Math.PI / 180;
    const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;

    // Report Distance
    if (missionMode.onDistanceUpdate) {
      missionMode.onDistanceUpdate(dist);
    }

    // Check Arrival
    const radius = missionMode.arrivalRadius || 5;
    if (dist < radius) {
      if (missionMode.onArrival) {
        missionMode.onArrival();
      }
    }

  }, [lat, lng, missionMode]);

  // 2. Safety Timeout (Fallback) - Removed to prioritize real GPS
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     if (!map.current) {
  //       console.warn("Map not initialized after timeout. Using fallback location.");
  //       setLng(TU_DARMSTADT[0]);
  //       setLat(TU_DARMSTADT[1]);
  //       setHasLocation(true);
  //       initMap(TU_DARMSTADT[0], TU_DARMSTADT[1]);
  //     }
  //   }, 2000); // 2 seconds timeout

  //   return () => clearTimeout(timer);
  // }, []);

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
          visitedPointsRef.current = data.visited_points; // Update ref
          setLevelData(calculateLevel(data.visited_points));
        }
        setDbPointsLoaded(true);
      };
      fetchPoints();
    }
  }, [session]);

  // Save visited points to Supabase (debounced)
  useEffect(() => {
    // Disable saving during Mission Mode to keep it a clean "Simulation"
    if (!session?.user?.id || !dbPointsLoaded || missionMode?.active) return;

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

  // --- MISSION MODE SETUP ---
  useEffect(() => {
    // Refs for cleanup
    let missionMarkers = [];

    if (missionMode?.active) {
      // 1. HARD RESET FOG (Only for first mission to start clean)
      if (missionMode.missionId === 'fog_test') {
        setVisitedPoints([]);
        visitedPointsRef.current = [];
      }

      // 2. Center Map on Start
      if (map.current) {
        const startPos = missionMode.startPosition || [8.6512, 49.8728];
        map.current.jumpTo({
          center: startPos,
          zoom: 15.0,
          pitch: 0,
          bearing: 0
        });
      }

      // 3. Draw Route immediately (if Fog Mission)
      if (missionMode.missionId === 'fog_test' && missionMode.startPosition) {
        // Clear previous route
        routeCoordsRef.current = null;
        if (map.current && map.current.getSource('route')) {
          map.current.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
        }

        // NO RED LINE for Research Version (User Request)
        // We rely solely on the Arrow Indicator.

        setTimeout(() => {
          // Re-add Target Marker just in case
          // Remove old Target markers if any exist in DOM (hacky cleanup)
          const oldMarkers = document.getElementsByClassName('mission-target-marker');
          while (oldMarkers.length > 0) {
            oldMarkers[0].parentNode.removeChild(oldMarkers[0]);
          }

          const el = document.createElement('div');
          el.className = 'mission-target-marker';
          el.style.background = 'white';
          el.style.width = '48px';
          el.style.height = '48px';
          el.style.borderRadius = '50%';
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.boxShadow = '0 0 15px rgba(0,255,136, 0.6)';
          el.style.border = '3px solid #00ff88';
          el.style.className = 'mission-target-marker'; // Tag for cleanup
          el.innerHTML = '<span style="font-size:24px;">🏁</span>';

          new maplibregl.Marker({ element: el })
            .setLngLat([8.6560, 49.8750])
            .addTo(map.current);

        }, 1500);
      }
    }

    return () => {
      // Cleanup
      missionMarkers.forEach(marker => marker.remove());
    };
  }, [missionMode]); // Removed appLoaded to allow re-runs on mode switch

  // --- MISSION 2 STATE ---
  const [m2State, setM2State] = useState('intro'); // intro | active | success | fail
  const [m2Timer, setM2Timer] = useState(5);
  const [m2Errors, setM2Errors] = useState(0);
  const m2StartTimeRef = useRef(null);
  const m2ClutterRefs = useRef([]); // To store marker instances

  // Mission 2 Timer Logic
  useEffect(() => {
    let interval;
    if (m2State === 'active' && m2Timer > 0) {
      interval = setInterval(() => {
        setM2Timer(prev => prev - 1);
      }, 1000);
    } else if (m2State === 'active' && m2Timer === 0) {
      // Timeout!
      setM2State('fail');
      handleM2Finish(false, 'timeout');
    }
    return () => clearInterval(interval);
  }, [m2State, m2Timer]);

  const startMission2 = () => {
    setM2State('active');
    m2StartTimeRef.current = Date.now();

    // SPAWN CLUTTER
    if (map.current) {
      // 1. Target (Active Memory Board - Full Color)
      // Visual goal: Bottom Left of the screen/area.
      const targetEl = document.createElement('div');
      targetEl.className = 'mission-marker-zone mission-target pulse-target';
      targetEl.style.width = '60px';
      targetEl.style.height = '60px'; // Larger than clutter
      targetEl.style.borderRadius = '50%';
      targetEl.style.cursor = 'pointer';
      targetEl.style.border = '3px solid #00ff88'; // Bright Green Border
      targetEl.style.boxShadow = '0 0 20px #00ff88';
      targetEl.style.overflow = 'hidden';
      targetEl.style.background = 'white';

      // Use the actual icon
      const targetImg = document.createElement('img');
      targetImg.src = '/memory-marker.jpg';
      targetImg.style.width = '100%';
      targetImg.style.height = '100%';
      targetImg.style.objectFit = 'cover'; // Ensure it fills circle
      targetImg.style.pointerEvents = 'none';
      targetEl.appendChild(targetImg);

      targetEl.onclick = () => {
        if (m2State !== 'active') return;
        setM2State('success');
        handleM2Finish(true, 'success');
      };

      const targetMarker = new maplibregl.Marker({ element: targetEl })
        .setLngLat([8.6505, 49.8720]) // South-West
        .addTo(map.current);
      m2ClutterRefs.current.push(targetMarker);

      // 2. Distractions (Inactive/Old Markers - Grayscale & Smaller)
      for (let i = 0; i < 25; i++) {
        const distEl = document.createElement('div');
        distEl.className = 'mission-clutter-dot';
        distEl.style.width = '40px';
        distEl.style.height = '40px';
        distEl.style.borderRadius = '50%';
        distEl.style.cursor = 'pointer';
        distEl.style.overflow = 'hidden';
        distEl.style.border = '2px solid #888';
        distEl.style.opacity = '0.7';
        distEl.style.background = '#eee';

        const distImg = document.createElement('img');
        distImg.src = '/memory-marker.jpg';
        distImg.style.width = '100%';
        distImg.style.height = '100%';
        distImg.style.objectFit = 'cover';
        distImg.style.filter = 'grayscale(100%)'; // The "fake" ones are grey
        distImg.style.pointerEvents = 'none';
        distEl.appendChild(distImg);

        distEl.onclick = () => {
          if (m2State !== 'active') return;
          setM2Errors(prev => prev + 1); // Track error
          distEl.style.borderColor = '#e74c3c'; // Red border on error
          distEl.style.transform = 'scale(0.9)';
        };

        // Random pos around center
        const rLng = 8.6510 + (Math.random() - 0.5) * 0.0035;
        const rLat = 49.8724 + (Math.random() - 0.5) * 0.0025;

        const distMarker = new maplibregl.Marker({ element: distEl })
          .setLngLat([rLng, rLat])
          .addTo(map.current);
        m2ClutterRefs.current.push(distMarker);
      }
    }
  };

  const handleM2Finish = (success, reason) => {
    // Cleanup markers
    setTimeout(() => {
      m2ClutterRefs.current.forEach(m => m.remove());
      m2ClutterRefs.current = [];
    }, 2000); // Keep visible for a sec so they see result

    // Calculate time
    const duration = Date.now() - m2StartTimeRef.current;

    // Delay export slightly to show "Success/Fail" screen
    setTimeout(() => {
      missionMode.onOutcome({
        success: success,
        reason: reason,
        duration_ms: duration,
        error_count: m2Errors,
        timer_left: m2Timer
      });
    }, 2000);
  };

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
  const onboardingStepRef = useRef(0);
  const onboardingOverlayRef = useRef(null);

  useEffect(() => {
    onboardingStepRef.current = onboardingStep;
    updateSpotlight(); // Update immediately on step change
  }, [onboardingStep]);

  const updateSpotlight = () => {
    if (!map.current || onboardingStepRef.current === 0 || !onboardingOverlayRef.current) return;

    let targetLng, targetLat;
    const step = onboardingStepRef.current;

    if (step >= 1 && step <= 3) {
      // User location
      if (userMarker.current) {
        const pos = userMarker.current.getLngLat();
        targetLng = pos.lng;
        targetLat = pos.lat;
      }
    } else if (step >= 4 && step <= 6) {
      // Memory Board location
      targetLng = TU_DARMSTADT[0];
      targetLat = TU_DARMSTADT[1];
    }

    if (targetLng && targetLat) {
      const point = map.current.project([targetLng, targetLat]);
      onboardingOverlayRef.current.style.setProperty('--spotlight-x', `${point.x}px`);
      onboardingOverlayRef.current.style.setProperty('--spotlight-y', `${point.y}px`);
    }
  };

  useEffect(() => {
    if (!map.current) return;

    // Attach updateSpotlight to map move events to keep it synced during animations
    map.current.on('move', updateSpotlight);
    map.current.on('moveend', updateSpotlight);

    return () => {
      if (map.current) {
        map.current.off('move', updateSpotlight);
        map.current.off('moveend', updateSpotlight);
      }
    };
  }, [map.current]); // Re-attach if map instance changes (though it shouldn't often)

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
    if (onboardingStep < 5) { // Changed from 6 to 5
      setOnboardingStep(prev => prev + 1);
    } else {
      setOnboardingStep(0); // Finish
      // Fly back to user location
      if (userMarker.current && map.current) { // Added map.current check
        const pos = userMarker.current.getLngLat();
        map.current.flyTo({
          center: pos,
          zoom: 15, // Changed from 16 to 15, removed duration and essential
        });
        setIsFollowing(true); // Kept this line
      }
    }
  };


  // --- MISSION MODE LATENCY TRACKING & STATE ---
  const missionStartRef = useRef(null);
  const [missionStep, setMissionStep] = useState('choice'); // 'choice' | 'followup'
  const [missionChoice, setMissionChoice] = useState(null); // 'efficiency' | 'discovery'

  useEffect(() => {
    if (missionMode?.active) {
      missionStartRef.current = Date.now();
      setMissionStep('choice');
      setMissionChoice(null);
    }
  }, [missionMode?.active]);

  const handleMissionClick = (choice) => {
    setMissionChoice(choice);
    setMissionStep('followup');
  };

  const handleFollowupSubmit = (followupAnswer) => {
    const duration = missionStartRef.current ? Date.now() - missionStartRef.current : 0;

    // Send full data object to App.jsx
    missionMode.onOutcome({
      choice: missionChoice,
      duration: duration,
      followup_answer: followupAnswer
    });
  };

  return (
    <div className="map-wrap">
      {showLoading && (
        <LoadingScreen text={loadingText} progress={loadingProgress} />
      )}

      {/* Legacy Info Modal Disabled */}
      {/* Modal Disabled for Simulator (Legacy) */}
      {/* {showInfo && ( ... )} */}

      {/* --- MISSION 1 OVERLAY --- */}
      {
        missionMode?.active && missionMode.missionId === '1_temptation' && (
          <div className="mission-overlay-container">
            {/* Markers are handled by map events now */}

            {/* Narrative Card */}
            <div className="mission-card-wrapper" style={{
              position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 2001, width: '90%', maxWidth: '450px'
            }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '24px', borderRadius: '16px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                textAlign: 'center', backdropFilter: 'blur(10px)'
              }}>
                {missionStep === 'choice' ? (
                  <>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#2c3e50', marginBottom: '12px' }}>
                      Mission 1: Die Versuchung
                    </h2>
                    <p style={{ fontSize: '1rem', lineHeight: '1.5', color: '#444', marginBottom: '16px' }}>
                      Du stehst am <strong>Willy-Brandt-Platz</strong> und musst dringend zur <strong>Uni</strong> (Mitte).
                      <br />
                      <em>Aber:</em> Im <strong>Herrngarten</strong> (oben im Nebel) ist gerade ein seltenes <strong>Memory Board</strong> aufgetaucht.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                      <button
                        onClick={() => handleMissionClick('efficiency')}
                        style={{
                          padding: '12px 20px',
                          background: '#FFD6A5', // Soft Peach/Orange (Accent)
                          color: '#5d4037', // Darker text for contrast
                          border: 'none', borderRadius: '12px',
                          fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer',
                          boxShadow: '0 4px 10px rgba(255, 214, 165, 0.4)',
                          transition: 'transform 0.1s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                      >
                        Zur Uni gehen (Effizient)
                      </button>
                      <button
                        onClick={() => handleMissionClick('discovery')}
                        style={{
                          padding: '12px 20px',
                          background: '#CDE7D0', // Folor Primary Soft Green
                          color: '#2E4C38', // Dark Green Text
                          border: 'none', borderRadius: '12px',
                          fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer',
                          boxShadow: '0 4px 10px rgba(205, 231, 208, 0.4)',
                          transition: 'transform 0.1s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                      >
                        Memory Board öffnen (Entdecken)
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* FOLLOW UP QUESTIONS */}
                    {missionChoice === 'efficiency' ? (
                      <>
                        <h2 style={{ fontSize: '1.2rem', color: '#2c3e50', marginBottom: '12px' }}>Kurze Frage...</h2>
                        <p style={{ fontSize: '0.95rem', color: '#555', marginBottom: '20px' }}>
                          Hast du keine Angst, etwas Spannendes zu verpassen (FOMO)?
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {['Nein, Fokus ist wichtiger.', 'Doch, aber Pflicht ruft.', 'Ich mag keine Überraschungen.'].map(ans => (
                            <button
                              key={ans}
                              onClick={() => handleFollowupSubmit(ans)}
                              style={{
                                padding: '10px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: '8px',
                                cursor: 'pointer', fontSize: '0.9rem', color: '#333'
                              }}
                            >
                              {ans}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 style={{ fontSize: '1.2rem', color: '#2c3e50', marginBottom: '12px' }}>Gute Wahl!</h2>
                        <p style={{ fontSize: '0.95rem', color: '#555', marginBottom: '20px' }}>
                          Was hat dich am meisten motiviert?
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {['Neugier / Entdeckerdrang', 'Abwechslung vom Alltag', 'Visueller Reiz (Nebel)'].map(ans => (
                            <button
                              key={ans}
                              onClick={() => handleFollowupSubmit(ans)}
                              style={{
                                padding: '10px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: '8px',
                                cursor: 'pointer', fontSize: '0.9rem', color: '#333'
                              }}
                            >
                              {ans}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Legacy Info Modal (Disabled) */}
      {/* Modal Disabled for Simulator */ false && (
        <div className="info-modal-overlay">
          <div className="info-modal">
            <div className="info-scroll-content">
              <h2>Willkommen bei Folor</h2>
              <p className="info-intro">
                Entdecke deine Umgebung neu. Der Nebel lichtet sich dort, wo du bist – und die Welt wird bunt.
              </p>

              <div className="info-steps">
                <div className="info-step">
                  <span className="step-number">1</span>
                  <div className="step-content">
                    <h2>Bewege dich</h2>
                    <p>Alles beginnt dunkel. Laufe los, um die Karte Schritt für Schritt freizuschalten.</p>
                  </div>
                </div>

                <div className="info-step">
                  <span className="step-number">2</span>
                  <div className="step-content">
                    <h2>Finde Memory Boards</h2>
                    <p>An besonderen Orten warten Memory Boards mit Fotos, Videos und Geschichten auf dich.</p>
                  </div>
                </div>

                <div className="info-step">
                  <span className="step-number">3</span>
                  <div className="step-content">
                    <h2>Hinterlasse Spuren</h2>
                    <p>Warst du hier? Poste dein eigenes Memory und werde Teil des Ortes.</p>
                  </div>
                </div>

                <div className="info-step">
                  <span className="step-number">4</span>
                  <div className="step-content">
                    <h2>Sammle Spots</h2>
                    <p>Je mehr du entdeckst, desto bunter wird deine Karte.</p>
                  </div>


                </div>

                <div className="info-step">
                  <span className="step-number">5</span>
                  <div className="step-content">
                    <h2>Standort & Browser</h2>
                    <p>Bitte erlaube den Standortzugriff. Falls die Karte leer bleibt, nutze einen anderen Browser.</p>
                  </div>
                </div>

                <div className="info-step">
                  <span className="step-number">6</span>
                  <div className="step-content">
                    <h2>Beta Version</h2>
                    <p>Dies ist eine frühe Version. Wir entwickeln Spotly ständig weiter. Das erste Memory Board wartet an der TU Darmstadt auf dich!</p>
                  </div>
                </div>
              </div>
            </div>


            <div className="info-footer">
              <button className="info-close-btn" onClick={startOnboarding}>Los geht's!</button>
            </div>
          </div>
        </div>

      )
      }



      {
        showBoard && (
          <MemoryBoard
            onClose={() => setShowBoard(null)}
            locationName={showBoard.name}
            locationImage={showBoard.image}
          />
        )
      }

      <div ref={mapContainer} className="map">
        <canvas ref={canvasRef} className="fog-overlay" />
      </div>

      {/* Top Bar Container */}
      <div className="map-top-bar">
        <LevelIndicator
          level={levelData.level}
          currentXP={levelData.currentXP}
          nextLevelXP={levelData.nextLevelXP}
          progress={levelData.progress}
          onClick={() => setShowChallenges(true)}
          style={{
            // Reset absolute positioning as it's now in flex container
            position: 'relative',
            top: 'auto',
            left: 'auto',
            transform: 'none',
            zIndex: 10,
            width: 'auto',
            maxWidth: 'none',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)'
          }}
        />

        {/* Address Search Bar */}
        <div className="search-container">
          <div className={`search-input-wrapper ${searchQuery ? 'expanded' : ''}`}>
            <svg className="search-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Suchen..."
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
      </div>



      {
        showChallenges && (
          <ChallengesModal onClose={() => setShowChallenges(false)} />
        )
      }

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

      {/* Off-screen Target Indicator */}
      {missionMode?.active && missionMode.missionId === 'fog_test' && (
        <TargetIndicator
          userLat={lat}
          userLng={lng}
          targetLat={49.8750}
          targetLng={8.6560}
          distance={(() => {
            if (!lat || !lng) return 0;
            const R = 6371e3;
            const phi1 = lat * Math.PI / 180;
            const phi2 = 49.8750 * Math.PI / 180;
            const dPhi = (49.8750 - lat) * Math.PI / 180;
            const dLambda = (8.6560 - lng) * Math.PI / 180;
            const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
          })()}
        />
      )}
      {/* GENERIC ARRIVAL LOGIC (For new missions) */}
      {missionMode?.active && missionMode.target && (() => {
        // Calculate Distance
        if (!lat || !lng) return null;

        const [targetLng, targetLat] = missionMode.target;
        const R = 6371e3;
        const phi1 = lat * Math.PI / 180;
        const phi2 = targetLat * Math.PI / 180;
        const dPhi = (targetLat - lat) * Math.PI / 180;
        const dLambda = (targetLng - lng) * Math.PI / 180;
        const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;

        // Check Arrival (Default 5 meters)
        const radius = missionMode.arrivalRadius || 5;

        // Notify parent about distance (throttled/effect based would be better but this works for render-loop logic if careful)
        // actually avoid side-effects in render. Use useEffect for side-effects below.

        return null; // Logic moved to useEffect below
      })()}

      {/* ARRIVAL POPUP (PROFESSIONAL / RESEARCH) */}
      {missionMode?.active && missionMode.missionId === 'fog_test' && (() => {
        if (!lat || !lng) return null;
        const R = 6371e3;
        const phi1 = lat * Math.PI / 180;
        const phi2 = 49.8750 * Math.PI / 180;
        const dPhi = (49.8750 - lat) * Math.PI / 180;
        const dLambda = (8.6560 - lng) * Math.PI / 180;
        const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;

        if (dist < 80) { // Arrival
          return (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#ffffff',
              padding: '40px',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              textAlign: 'left',
              zIndex: 2000,
              maxWidth: '500px',
              width: '90%',
              border: '1px solid #e0e0e0',
              fontFamily: "'Inter', sans-serif"
            }}>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '1.5rem', color: '#1a1a1a', fontWeight: '600' }}>Ziel erreicht.</h2>
              <p style={{ fontSize: '1rem', color: '#555', marginBottom: '30px' }}>
                Vielen Dank für die Teilnahme. Bitte beantworten Sie kurz diese zwei Fragen zur Auswertung der Simulation.
              </p>

              {/* Question 1 */}
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '10px', color: '#333' }}>
                  1. Wie sicher haben Sie sich bei der Orientierung gefühlt?
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f5f5f5', padding: '10px', borderRadius: '8px' }}>
                  {['Sehr unsicher', 'Unsicher', 'Neutral', 'Sicher', 'Sehr sicher'].map((label, i) => (
                    <button key={i} style={{
                      border: '1px solid #ddd', background: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', flex: 1, margin: '0 5px'
                    }} onClick={(e) => {
                      // Simple visual selection logic could go here, for now just alert/log 
                      e.target.style.borderColor = '#3498db';
                      e.target.style.background = '#ebf5fb';
                    }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 2 */}
              <div style={{ marginBottom: '30px' }}>
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '10px', color: '#333' }}>
                  2. Hat der Nebel Ihre Routenwahl maßgeblich beeinflusst?
                </label>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <button style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}
                    onClick={(e) => { e.target.style.background = '#ebf5fb'; e.target.style.borderColor = '#3498db'; }}
                  >
                    Nein, ich folgte strikt der Richtung.
                  </button>
                  <button style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}
                    onClick={(e) => { e.target.style.background = '#ebf5fb'; e.target.style.borderColor = '#3498db'; }}
                  >
                    Ja, ich musste oft ausweichen/suchen.
                  </button>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'right' }}>
                <button style={{
                  background: '#1a1a1a', color: 'white', border: 'none',
                  padding: '12px 30px', borderRadius: '6px', fontSize: '1rem', cursor: 'pointer',
                  fontWeight: '500'

                }} onClick={() => {
                  if (missionMode.onComplete) {
                    missionMode.onComplete({ mission: 'fog_test', success: true });
                  } else {
                    console.log("Legacy Mode: Reloading");
                    window.location.reload();
                  }
                }}>
                  Abschließen
                </button>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* --- MISSION 2 CLUTTER OVERLAY --- */}
      {
        missionMode?.active && missionMode.missionId === '2_clutter' && (
          <div className="mission-overlay-container" style={{ pointerEvents: 'none' }}>
            {/* POINTER EVENTS NONE ON CONTAINER so we can click map, BUT enabled on children buttons */}

            {/* INTRO SCREEN */}
            {m2State === 'intro' && (
              <div style={{
                pointerEvents: 'auto',
                background: 'rgba(255,255,255,0.95)', padding: '30px', borderRadius: '20px',
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', maxWidth: '90%'
              }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>⚡️ Blitz-Challenge</h2>
                <p style={{ fontSize: '1rem', color: '#555', marginBottom: '20px', lineHeight: '1.5' }}>
                  Du hast genau <strong>5 Sekunden</strong> Zeit!
                  <br />
                  Finde und klicke auf das <strong>grüne Memory Board</strong> am Luisenplatz.
                  <br />
                  <span style={{ fontSize: '0.9rem', color: '#999' }}>(Es liegt unten links im Chaos)</span>
                </p>
                <button
                  onClick={startMission2}
                  style={{
                    background: '#333', color: 'white', border: 'none', padding: '15px 40px',
                    fontSize: '1.2rem', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold'
                  }}
                >
                  GO!
                </button>
              </div>
            )}

            {/* ACTIVE TIMER */}
            {m2State === 'active' && (
              <div style={{
                position: 'absolute', top: '100px', left: '50%', transform: 'translateX(-50%)',
                background: m2Timer <= 2 ? '#e74c3c' : '#333',
                color: 'white', padding: '10px 30px', borderRadius: '50px',
                fontSize: '2rem', fontWeight: 'bold',
                boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
                transition: 'background 0.3s'
              }}>
                {m2Timer}s
              </div>
            )}

            {/* RESULTS */}
            {m2State === 'success' && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                background: '#2ecc71', color: 'white', padding: '40px', borderRadius: '20px',
                textAlign: 'center', boxShadow: '0 20px 50px rgba(46, 204, 113, 0.4)'
              }}>
                <h1>🎉 GEFUNDEN!</h1>
                <p>Klasse Reaktion.</p>
              </div>
            )}

            {m2State === 'fail' && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                background: '#e74c3c', color: 'white', padding: '40px', borderRadius: '20px',
                textAlign: 'center', boxShadow: '0 20px 50px rgba(231, 76, 60, 0.4)'
              }}>
                <h1>⏰ ZU SPÄT!</h1>
                <p>Das war zu viel Chaos.</p>
              </div>
            )}
          </div>
        )
      }
      {
        onboardingStep > 0 && (
          <div
            ref={onboardingOverlayRef}
            className={`onboarding-overlay step-${onboardingStep}`}
            style={getSpotlightStyle()}
          >
            <div className="spotlight-mask"></div>

            <div className="onboarding-content">
              {onboardingStep === 1 && (
                <div className="onboarding-card">
                  <h2>Hier bist du.</h2>
                  <div className="onboarding-actions">
                    <button className="onboarding-skip-btn" onClick={() => setOnboardingStep(0)}>Überspringen</button>
                    <button className="onboarding-btn" onClick={nextOnboardingStep}>Weiter</button>
                  </div>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="onboarding-card">
                  <h2>Alles ist noch neblig.</h2>
                  <div className="onboarding-actions">
                    <button className="onboarding-skip-btn" onClick={() => setOnboardingStep(0)}>Überspringen</button>
                    <button className="onboarding-btn" onClick={nextOnboardingStep}>Weiter</button>
                  </div>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="onboarding-card">
                  <h2>Lauf los, um Farben zu sehen.</h2>
                  <div className="onboarding-actions">
                    <button className="onboarding-skip-btn" onClick={() => setOnboardingStep(0)}>Überspringen</button>
                    <button className="onboarding-btn" onClick={nextOnboardingStep}>Weiter</button>
                  </div>
                </div>
              )}

              {onboardingStep === 4 && (
                <div className="onboarding-card">
                  <h2>Entdecke und Poste in MemoryBoards.</h2>
                  <div className="onboarding-actions">
                    <button className="onboarding-skip-btn" onClick={() => setOnboardingStep(0)}>Überspringen</button>
                    <button className="onboarding-btn" onClick={nextOnboardingStep}>Weiter</button>
                  </div>
                </div>
              )}

              {onboardingStep === 5 && (
                <div className="onboarding-card">
                  <h2>Nur vor Ort sichtbar.</h2>
                  <button className="onboarding-btn" onClick={nextOnboardingStep}>Alles klar!</button>
                </div>
              )}
            </div>
          </div>
        )
      }
    </div >
  );
}
