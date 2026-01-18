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
  const missionModeRef = useRef(missionMode); // Stable ref for effects
  missionModeRef.current = missionMode; // Always update to latest

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
  const virtualPosRef = useRef(null); // { lng, lat }
  const [isWalking, setIsWalking] = useState(false);
  const animationRef = useRef(null);
  const routeCoordsRef = useRef(null);
  // --- MYSTERY GLOWS (Curiosity Test) ---
  const mysteryPointsRef = useRef([]); // [{lng, lat, found: false, id: 1}]
  const collectedAnimationsRef = useRef([]); // [{x, y, text, startTime}]
  const metricsRef = useRef({ distanceWalked: 0, collectedLights: 0 });
  const lastMissionIdRef = useRef(null); // Stability Fix
  const [currentDistance, setCurrentDistance] = useState(0);
  const [currentBearing, setCurrentBearing] = useState(0);
  const lastUpdateRef = useRef(0); // Throttle UI updates

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

    // 0. Draw "Hidden" Target Glows (BEFORE Fog Fill)
    // This allows them to be visible *through* the fog (faintly) and fully revealed when fog is cut.
    if (missionMode?.target && missionMode?.active) {
      const [tLng, tLat] = missionMode.target;
      const { x, y } = map.current.project([tLng, tLat]);

      // Only draw if on screen
      if (x >= -50 && x <= width + 50 && y >= -50 && y <= height + 50) {
        const now = Date.now();
        const pulse = (Math.sin(now / 400) + 1) / 2; // Faster pulse
        const baseR = 15;
        const r = baseR + (pulse * 15);

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
        grad.addColorStop(0, 'rgba(76, 209, 55, 1)'); // Bright Green Core
        grad.addColorStop(0.4, 'rgba(76, 209, 55, 0.6)');
        grad.addColorStop(1, 'rgba(76, 209, 55, 0)');

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 2, 0, Math.PI * 2);
        ctx.fill();

        // White center dot
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 1. Draw Fog Background
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'; // Slightly thicker fog to hide secrets better
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


    // 2.5 FORCE VISIBLE TARGET for specific missions (Mission 4, 5, 6)
    // Draw ON TOP of fog to guide user clearly.
    if (missionMode?.target && missionMode?.active &&
      (missionMode.missionId === 'creation_barrier' || missionMode.missionId === 'social_proof' || missionMode.missionId === 'incentive_detour')) {

      const [tLng, tLat] = missionMode.target;
      const { x, y } = map.current.project([tLng, tLat]);

      // Only draw if on screen
      if (x >= -50 && x <= width + 50 && y >= -50 && y <= height + 50) {
        const now = Date.now();
        const pulse = (Math.sin(now / 400) + 1) / 2; // Pulse 0..1
        const baseR = 25;
        const r = baseR + (pulse * 25); // Large pulsing radius

        // Blue Glow for Creation, Green/Cyan for Social
        const color = missionMode.missionId === 'creation_barrier'
          ? '0, 122, 255'   // IOS Blue
          : '0, 255, 255';  // Cyan

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
        grad.addColorStop(0, `rgba(${color}, 0.8)`);
        grad.addColorStop(0.5, `rgba(${color}, 0.4)`);
        grad.addColorStop(1, `rgba(${color}, 0)`);

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 2, 0, Math.PI * 2);
        ctx.fill();

        // White center dot
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
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

      // Draw Icon or Dot
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Add a "Question Mark" or symbol?
      // Maybe just the glow is more mysterious (User said "iwo verstecken")
    });

    // 3. Cut Holes & Tunnel (Path Construction)
    ctx.globalCompositeOperation = 'destination-out';

    // Get current User Pos for calculations
    let currentLat = 50;
    let currentLng = 8;
    if (userMarker.current) {
      const pos = userMarker.current.getLngLat();
      currentLat = pos.lat;
      currentLng = pos.lng;
    } else if (map.current) {
      currentLat = map.current.getCenter().lat;
    }

    // 3a. Draw Continuous Path (Tunnel)
    if (visitedPointsRef.current.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const currentRadius = getPixelRadius(currentLat);
      ctx.lineWidth = currentRadius * 2.5; // Wider path
      // SOFT EDGE: Large shadow blur
      ctx.shadowBlur = currentRadius;
      ctx.shadowColor = 'black';

      ctx.beginPath();

      visitedPointsRef.current.forEach((point, index) => {
        const { x, y } = map.current.project([point.lng, point.lat]);
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      // Connection to current user position
      if (userMarker.current) {
        const { x, y } = map.current.project([currentLng, currentLat]);
        ctx.lineTo(x, y);
      }

      ctx.stroke();

      // Reset Shadow
      ctx.shadowBlur = 0;
    }

    // 3b. Draw Head Hole (Current Position)
    const drawHole = (lng, lat) => {
      const { x, y } = map.current.project([lng, lat]);
      const radius = Math.max(getPixelRadius(lat), 1);

      // Use simple arc for destination-out with soft edge via gradient or shadow
      const gradient = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 1.5);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)'); // Full cut
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.8)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Fade to fog

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
    };

    if (userMarker.current) {
      drawHole(currentLng, currentLat);
    }

    if (visitedPointsRef.current.length === 1) {
      drawHole(visitedPointsRef.current[0].lng, visitedPointsRef.current[0].lat);
    }

    // 4. DRAW BADGES (Mission 6) - Explicitly ON TOP
    if (missionMode?.active && missionMode.missionId === 'incentive_detour') {
      mysteryPointsRef.current.forEach(point => {
        if (point.found) return; // Hide if collected

        const { x, y } = map.current.project([point.lng, point.lat]);
        // Only draw if on screen
        if (x < -50 || x > width + 50 || y < -50 || y > height + 50) return;

        // RENDER BADGE (Gold Diamond - CLEARLY VISIBLE)
        const now = Date.now();
        const bounce = Math.sin(now / 300) * 5; // Bouncing up/down

        ctx.globalCompositeOperation = 'source-over'; // Switch back to drawing

        // Glow
        const grad = ctx.createRadialGradient(x, y + bounce, 0, x, y + bounce, 40);
        grad.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
        grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y + bounce, 40, 0, Math.PI * 2);
        ctx.fill();

        // Diamond Shape
        ctx.fillStyle = '#FFD700'; // Gold
        ctx.strokeStyle = '#DAA520'; // Darker Gold
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(x, y + bounce - 18);
        ctx.lineTo(x + 18, y + bounce);
        ctx.lineTo(x, y + bounce + 18);
        ctx.lineTo(x - 18, y + bounce);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    }

    // 5. DRAW FLOATING ANIMATIONS (XP POPS)
    if (collectedAnimationsRef.current.length > 0) {
      const now = Date.now();
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';

      collectedAnimationsRef.current = collectedAnimationsRef.current.filter(anim => {
        const age = now - anim.startTime;
        if (age > 1500) return false; // Remove after 1.5s

        const progress = age / 1500;
        const floatY = -50 * progress; // Float up 50px
        const alpha = 1 - Math.pow(progress, 3); // Fade out late

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.lineWidth = 3;

        ctx.strokeText(anim.text, anim.x, anim.y + floatY);
        ctx.fillText(anim.text, anim.x, anim.y + floatY);

        return true;
      });
    }
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

    // Use refs for start position to avoid state dependency
    let startLng, startLat;
    if (virtualPosRef.current) {
      startLng = virtualPosRef.current.lng;
      startLat = virtualPosRef.current.lat;
    } else if (userMarker.current) {
      const pos = userMarker.current.getLngLat();
      startLng = pos.lng;
      startLat = pos.lat;
    } else {
      startLng = lng;
      startLat = lat;
    }

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

      // Track Distance Walked (approx based on step)
      // Real distance logic would be better but this is fine for now (accumulate delta)
      // Better: Calculate delta from last frame virtualPos
      if (virtualPosRef.current) {
        const dStep = 6371e3 * 2 * Math.atan2(
          Math.sqrt(Math.pow(Math.sin(((currentLat - virtualPosRef.current.lat) * Math.PI / 180) / 2), 2) + Math.cos(virtualPosRef.current.lat * Math.PI / 180) * Math.cos(currentLat * Math.PI / 180) * Math.pow(Math.sin(((currentLng - virtualPosRef.current.lng) * Math.PI / 180) / 2), 2)),
          Math.sqrt(1 - (Math.pow(Math.sin(((currentLat - virtualPosRef.current.lat) * Math.PI / 180) / 2), 2) + Math.cos(virtualPosRef.current.lat * Math.PI / 180) * Math.cos(currentLat * Math.PI / 180) * Math.pow(Math.sin(((currentLng - virtualPosRef.current.lng) * Math.PI / 180) / 2), 2)))
        );
        metricsRef.current.distanceWalked += dStep;
      }

      // Virtual Pos Update
      virtualPosRef.current = { lng: currentLng, lat: currentLat };

      // Check Collection of Mystery Lights
      mysteryPointsRef.current.forEach(point => {
        if (!point.found) {
          const dToPoint = 6371e3 * 2 * Math.atan2(
            Math.sqrt(Math.pow(Math.sin(((point.lat - currentLat) * Math.PI / 180) / 2), 2) + Math.cos(currentLat * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180) * Math.pow(Math.sin(((point.lng - currentLng) * Math.PI / 180) / 2), 2)),
            Math.sqrt(1 - (Math.pow(Math.sin(((point.lat - currentLat) * Math.PI / 180) / 2), 2) + Math.cos(currentLat * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180) * Math.pow(Math.sin(((point.lng - currentLng) * Math.PI / 180) / 2), 2)))
          );

          if (dToPoint < 30) { // 30m collection radius
            point.found = true;
            metricsRef.current.collectedLights += 1;

            // Trigger Animation / Callback
            if (missionModeRef.current?.missionId === 'incentive_detour') {
              // Notify App -> App updates MissionIncentive -> Popup appears
              if (missionModeRef.current.onCollectibleFound) {
                missionModeRef.current.onCollectibleFound({
                  ...point,
                  found: true
                });
              }
            }
          }
        }
      });

      // Update Marker
      if (userMarker.current) {
        userMarker.current.setLngLat([currentLng, currentLat]);
      }

      // Smooth Follow (Per Frame Camera Update)
      if (map.current && isFollowing) {
        map.current.jumpTo({
          center: [currentLng, currentLat],
          zoom: map.current.getZoom(), // Preserve zoom
          essential: true // Ensure it happens
        });
      }

      // Update Fog & Visited (Ref Only)
      // Filter close points
      const lastPoint = visitedPointsRef.current[visitedPointsRef.current.length - 1];
      let shouldAdd = true;
      if (lastPoint) {
        const d = Math.sqrt(Math.pow(lastPoint.lng - currentLng, 2) + Math.pow(lastPoint.lat - currentLat, 2));
        if (d < 0.00005) shouldAdd = false;
      }

      if (shouldAdd) {
        visitedPointsRef.current.push({ lng: currentLng, lat: currentLat });
      }

      // Check Arrival specific for Virtual Walk (using stable Ref)
      if (missionModeRef.current?.target && missionModeRef.current?.active) {
        const [tLng, tLat] = missionModeRef.current.target;
        const d = 6371e3 * 2 * Math.atan2(
          Math.sqrt(Math.pow(Math.sin(((tLat - currentLat) * Math.PI / 180) / 2), 2) + Math.cos(currentLat * Math.PI / 180) * Math.cos(tLat * Math.PI / 180) * Math.pow(Math.sin(((tLng - currentLng) * Math.PI / 180) / 2), 2)),
          Math.sqrt(1 - (Math.pow(Math.sin(((tLat - currentLat) * Math.PI / 180) / 2), 2) + Math.cos(currentLat * Math.PI / 180) * Math.cos(tLat * Math.PI / 180) * Math.pow(Math.sin(((tLng - currentLng) * Math.PI / 180) / 2), 2)))
        );

        // Throttled Updates (100ms = 10fps for UI, sufficient for text/arrow)
        if (Date.now() - lastUpdateRef.current > 100) {
          if (missionModeRef.current.onDistanceUpdate) {
            missionModeRef.current.onDistanceUpdate(d);
          }

          setCurrentDistance(d);

          // Calculate Bearing for Arrow
          const y = Math.sin((tLng - currentLng) * Math.PI / 180) * Math.cos(tLat * Math.PI / 180);
          const x = Math.cos(currentLat * Math.PI / 180) * Math.sin(tLat * Math.PI / 180) -
            Math.sin(currentLat * Math.PI / 180) * Math.cos(tLat * Math.PI / 180) * Math.cos((tLng - currentLng) * Math.PI / 180);
          const brng = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
          setCurrentBearing(brng);

          lastUpdateRef.current = Date.now();
        }

        const radius = missionMode.arrivalRadius || 20; // Increased default slightly for virtual
        if (d < radius && missionMode.onArrival) {
          missionMode.onArrival({
            distanceWalked: Math.round(metricsRef.current.distanceWalked),
            collectedLights: metricsRef.current.collectedLights,
            totalLights: mysteryPointsRef.current.length,
            fogPath: visitedPointsRef.current // The raw path data
          });
        }
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animateWalk);
      } else {
        setIsWalking(false);
        setVisitedPoints([...visitedPointsRef.current]);
        setLng(targetLng);
        setLat(targetLat);
      }
    };

    animationRef.current = requestAnimationFrame(animateWalk);
  };

  // Initial Distance Check (for static start)
  useEffect(() => {
    // Don't fight with the virtual walk loop
    if (isWalking) return;

    const mm = missionModeRef.current;
    if (mm?.active && mm?.target && lng && lat) {
      const [tLng, tLat] = mm.target;
      const dist = 6371e3 * 2 * Math.atan2(
        Math.sqrt(Math.pow(Math.sin(((tLat - lat) * Math.PI / 180) / 2), 2) + Math.cos(lat * Math.PI / 180) * Math.cos(tLat * Math.PI / 180) * Math.pow(Math.sin(((tLng - lng) * Math.PI / 180) / 2), 2)),
        Math.sqrt(1 - (Math.pow(Math.sin(((tLat - lat) * Math.PI / 180) / 2), 2) + Math.cos(lat * Math.PI / 180) * Math.cos(tLat * Math.PI / 180) * Math.pow(Math.sin(((tLng - lng) * Math.PI / 180) / 2), 2)))
      );

      if (mm.onDistanceUpdate) {
        mm.onDistanceUpdate(dist);
      }
      setCurrentDistance(dist);
    }
  }, [missionMode?.missionId, lng, lat, isWalking]); // Only re-run if mission ID or static position changes

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
  }, [missionMode, isWalking]); // Removed lng/lat/virtualPos deps as we use refs now


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
    const mm = missionModeRef.current;

    // 0. VIRTUAL MODE (Override Geolocation)
    if (mm?.isVirtual) {
      if (!hasLocation && mm.startPosition) {
        const [startLng, startLat] = mm.startPosition;
        generateMysteryPoints(startLng, startLat);
        setLng(startLng);
        setLat(startLat);
        virtualPosRef.current = { lng: startLng, lat: startLat };
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
          if (missionModeRef.current?.isVirtual) return; // Disable real GPS in virtual mode

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
  }, [API_KEY, zoom, hasLocation, isFollowing, missionMode?.missionId]);

  // --- GENERIC TARGET DETECTION (New Missions) ---
  useEffect(() => {
    // Conflict Prevention: If virtual, let the animation loop handle updates.
    if (!missionMode?.target || !lat || !lng || missionMode?.isVirtual) return;

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
    // If in Fog Test mission, start clean (don't load old points)
    if (missionMode?.missionId === 'fog_test') {
      setDbPointsLoaded(true);
      return;
    }

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
  const prevMissionIdRef = useRef(null);

  // --- Initialize Mission Data (Badges/Metrics) ---
  useEffect(() => {
    // Only initializing if Mission ID actually CHANGED
    if (missionMode?.missionId !== lastMissionIdRef.current) {
      lastMissionIdRef.current = missionMode?.missionId;

      if (missionMode?.missionId === 'incentive_detour' && missionMode.badges) {
        // Load Badges from Config
        mysteryPointsRef.current = missionMode.badges.map(b => ({ ...b, found: false }));
        metricsRef.current = { distanceWalked: 0, collectedLights: 0 };
        setVisitedPoints([]); // Clear path
        visitedPointsRef.current = [];
      } else if (missionMode?.active && missionMode.missionId !== 'incentive_detour') {
        // For Mission 1, generate random if needed
        if (mysteryPointsRef.current.length === 0 && missionMode.missionId === 'fog_test' && lat) {
          generateMysteryPoints(lng, lat);
        }
      }
    }
  }, [missionMode?.missionId, lat, lng]); // Added lat, lng to dependencies for generateMysteryPoints

  useEffect(() => {
    // Refs for cleanup
    let missionMarkers = [];

    // Only run setup if mission is active AND it's a NEW mission
    if (missionMode?.active && missionMode?.missionId !== prevMissionIdRef.current) {
      console.log(`🚀 Starting Mission: ${missionMode.missionId}`);

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

        // NO RED LINE for Research Version
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
          el.innerHTML = '<span style="font-size:24px;">🏁</span>';

          new maplibregl.Marker({ element: el })
            .setLngLat([8.6560, 49.8750])
            .addTo(map.current);

        }, 1500);
      }

      // Update Ref at the end
      prevMissionIdRef.current = missionMode.missionId;
    }

    return () => {
      // Cleanup if needed
    };
  }, [missionMode?.missionId]);

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

      {/* Off-screen Target Indicator (Mission 1) */}
      {missionMode?.active && missionMode.missionId === 'fog_test' && (
        <TargetIndicator
          userLat={lat}
          userLng={lng}
          targetLat={49.8750}
          targetLng={8.6560}
          distance={currentDistance}
          bearing={currentBearing}
        />
      )}

      {/* GLOWING TARGET POINT (Mission 2) - Under Fog */}
      {missionMode?.active && (missionMode.missionId === 'secret_board' || missionMode.missionId === 'fog_test') && missionMode.target && (() => {
        // We render this as a simple absolute div projected onto the map? 
        // No, simpler to use a React Portal or just a Marker if we can control z-index.
        // Let's use a Marker created in useEffect or similar? 
        // Easier: Just render a marker-like div if we had a <Marker> component. 
        // Since we don't have a clean React <Marker> component exposed here (using maplibregl directly),
        // I will rely on the fact that I can't easily inject a React component into the map pane *under* the canvas without a Portal.

        // ALTERNATIVE: Draw the glow on the canvas *before* the fog fill? 
        // Yes, in `drawFog`. That's what `mysteryPointsRef` was doing.
        // But the user wants a SPECIFIC point for Mission 2.

        // I will ADD the Mission 2 Target to `mysteryPointsRef` or similar logic in `drawFog`.
        // Actually, `drawFog` already has the "drawMysteryGlows" logic locally defined?
        // Let's modify `drawFog` to specifically draw the Mission 2 target glow.
        return null;
      })()
      }
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
