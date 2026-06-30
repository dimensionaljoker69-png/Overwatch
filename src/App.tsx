import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Activity,
  Map as MapIcon,
  Camera,
  Terminal,
  ActivitySquare,
  Compass,
  AlertTriangle,
  Play,
  RotateCcw,
  Plus,
  Send,
  Navigation,
  Database,
  ExternalLink,
  ChevronRight,
  Wifi,
  FileSpreadsheet,
  Cloud,
  Wind,
  Thermometer,
  Droplets,
  Ruler
} from 'lucide-react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, getAccessToken } from './auth';
import { CameraData, TriageRecord, FrequencyRecord, Coordinates } from './types';
import { AudioFrequencyScanner } from './components/AudioFrequencyScanner';
import { CameraFeed } from './components/CameraFeed';
import { WorkspaceSync } from './components/WorkspaceSync';
import { MedicalTriage } from './components/MedicalTriage';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'cameras' | 'comms' | 'triage'>('map');
  
  // Geolocation & Map Coordinates
  const [currentCoords, setCurrentCoords] = useState<Coordinates>({ lat: 33.7490, lng: -84.3880 }); // Default Atlanta
  const [targetCoords, setTargetCoords] = useState<Coordinates | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [routingLine, setRoutingLine] = useState<any>(null);

  // Optical cameras state (GDOT)
  const [allCameras, setAllCameras] = useState<CameraData[]>([]);
  const [filteredCameras, setFilteredCameras] = useState<CameraData[]>([]);
  const [cameraSearch, setCameraSearch] = useState<string>('');

  // Frequencies state
  const [frequencies, setFrequencies] = useState<FrequencyRecord[]>([
    { channel: 'APD ZONE 1 DISPATCH', frequency: '460.125', description: 'Atlanta Police Department Patrol Division Zone 1', type: 'police', status: 'active', lastActive: new Date().toISOString() },
    { channel: 'AFD TAC-3 MUTUAL', frequency: '154.280', description: 'Fire Dispatch & Mutual Aid Operations', type: 'fire', status: 'monitoring', lastActive: new Date().toISOString() },
    { channel: 'GSP HELO RECON', frequency: '154.920', description: 'Georgia State Patrol Airborne Reconnaissance Channel', type: 'air', status: 'idle', lastActive: new Date().toISOString() },
    { channel: 'HEVAL EMERGENCY DISPATCH', frequency: '155.340', description: 'LifeSaves & Ambulance Medical Airlift Operations', type: 'ems', status: 'active', lastActive: new Date().toISOString() }
  ]);

  // Triage state
  const [triageProtocols, setTriageProtocols] = useState<TriageRecord[]>([
    {
      Procedure_Title: 'TACTICAL HEMORRHAGE CONTROL',
      Priority_Calculation: 'CRITICAL PRIORITY 1',
      Instructions: '1. Place Tourniquet high & tight on the bleeding extremity immediately.\n2. Wrap tightly with trauma wound packing dressing.\n3. Note tourniquet placement time clearly on the client\'s forehead (T-Time).\n4. Assess pulse distal to tourniquet placement.'
    },
    {
      Procedure_Title: 'AIRWAY FAILURE & DECOMPRESSION',
      Priority_Calculation: 'CRITICAL PRIORITY 1',
      Instructions: '1. Position casualty in recovery posture if unconscious.\n2. Assess for tension pneumothorax: look for uneven chest expansion, progressive dyspnea.\n3. Prepare needle decompression (14G needle inserted at 2nd intercostal space mid-clavicular line).'
    },
    {
      Procedure_Title: 'THERMAL EXTREME TREATMENT',
      Priority_Calculation: 'MEDIUM PRIORITY 3',
      Instructions: '1. Move patient immediately into secure shaded environment.\n2. Apply ice packs / wet cold compresses directly to neck, groin, axillae.\n3. Administer balanced electrolyte rehydration solution incrementally.'
    }
  ]);
  const [triageSearch, setTriageSearch] = useState<string>('');

  // Firebase OAuth / Workspace
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Console Logs Terminal
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '>>> W.O.L.F. SECURE OVERWATCH SYSTEM ONLINE v3.5',
    '>>> MULTI-SENSORY FREQUENCY SYNTHESIZERS DEPLOYED',
    '>>> INTERCEPT CHANNELS ESTABLISHED'
  ]);
  const [customCommand, setCustomCommand] = useState<string>('');

  // Weather state & layers
  const [weather, setWeather] = useState<{
    temp: number;
    humidity: number;
    windSpeed: number;
    windDir: number;
    condition: string;
    hazardStatus: 'STABLE' | 'WARNING' | 'CRITICAL';
    hazardDetails: string[];
    source: 'OpenWeatherMap' | 'Open-Meteo Backup';
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [activeWeatherLayer, setActiveWeatherLayer] = useState<'none' | 'precipitation' | 'clouds' | 'temp' | 'wind'>('none');

  // Map elements ref & local tracking
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const positionMarkerRef = useRef<any>(null);
  const targetMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const weatherLayerRef = useRef<any>(null);
  const weatherCircleRef = useRef<any>(null);

  // Distance Measurement (Tactical Ruler) State and Refs
  const [isMeasuringMode, setIsMeasuringMode] = useState<boolean>(false);
  const [measurementResult, setMeasurementResult] = useState<{
    distanceMeters: number;
    miles: number;
    kilometers: number;
    coords: [Coordinates, Coordinates];
  } | null>(null);

  const isMeasuringModeRef = useRef<boolean>(false);
  const handleMeasureClickRef = useRef<(latlng: any, map: any) => void>(() => {});
  const measurePointsRef = useRef<Coordinates[]>([]);
  const measureMarkersRef = useRef<any[]>([]);
  const measureLineRef = useRef<any | null>(null);
  const measurePopupRef = useRef<any | null>(null);

  // Sync measuring mode state to Ref for listener access
  useEffect(() => {
    isMeasuringModeRef.current = isMeasuringMode;
  }, [isMeasuringMode]);

  const calculateAzimuth = (p1: Coordinates, p2: Coordinates) => {
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const lat1 = p1.lat * Math.PI / 180;
    const lat2 = p2.lat * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  };

  const clearMeasurement = () => {
    const map = mapInstanceRef.current;
    if (map) {
      measureMarkersRef.current.forEach((m) => {
        try { map.removeLayer(m); } catch (e) {}
      });
      measureMarkersRef.current = [];

      if (measureLineRef.current) {
        try { map.removeLayer(measureLineRef.current); } catch (e) {}
        measureLineRef.current = null;
      }

      if (measurePopupRef.current) {
        try { map.removeLayer(measurePopupRef.current); } catch (e) {}
        measurePopupRef.current = null;
      }
    }

    measurePointsRef.current = [];
    setMeasurementResult(null);
    logToTerminal(">>> LOGISTICS MEASUREMENT PURGED");
  };

  const handleMeasureClick = (latlng: any, map: any) => {
    const points = measurePointsRef.current;

    // If we already have 2 points, clear and start over
    if (points.length >= 2) {
      measureMarkersRef.current.forEach((m) => {
        try { map.removeLayer(m); } catch (e) {}
      });
      measureMarkersRef.current = [];

      if (measureLineRef.current) {
        try { map.removeLayer(measureLineRef.current); } catch (e) {}
        measureLineRef.current = null;
      }

      if (measurePopupRef.current) {
        try { map.removeLayer(measurePopupRef.current); } catch (e) {}
        measurePopupRef.current = null;
      }

      measurePointsRef.current = [];
    }

    const clickedCoord: Coordinates = { lat: latlng.lat, lng: latlng.lng };
    measurePointsRef.current.push(clickedCoord);

    const pointLabel = measurePointsRef.current.length === 1 ? 'A' : 'B';
    const isEnd = measurePointsRef.current.length === 2;

    const pinIcon = L.divIcon({
      html: `<div class="flex items-center justify-center bg-zinc-950 border-2 ${isEnd ? 'border-cyan-400 text-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'border-amber-400 text-amber-400 shadow-[0_0_6px_#fbbf24]'} font-bold text-[10px] rounded-sm w-5 h-5 select-none font-mono">${pointLabel}</div>`,
      className: 'measure-marker-pin',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const marker = L.marker([latlng.lat, latlng.lng], { icon: pinIcon }).addTo(map);
    measureMarkersRef.current.push(marker);

    logToTerminal(`>>> PLOTTED MEASUREMENT POINT [${pointLabel}]: LAT ${latlng.lat.toFixed(5)} • LNG ${latlng.lng.toFixed(5)}`);

    if (measurePointsRef.current.length === 2) {
      const p1 = measurePointsRef.current[0];
      const p2 = measurePointsRef.current[1];

      // Draw logistics line
      const polyline = L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {
        color: '#22d3ee',
        weight: 3,
        dashArray: '6, 6',
        opacity: 0.85
      }).addTo(map);

      measureLineRef.current = polyline;

      // Calculate distance using Leaflet helper
      const latlng1 = L.latLng(p1.lat, p1.lng);
      const latlng2 = L.latLng(p2.lat, p2.lng);
      const distanceMeters = latlng1.distanceTo(latlng2);
      const miles = distanceMeters * 0.000621371;
      const kilometers = distanceMeters / 1000;

      // Calculate midpoint
      const midLat = (p1.lat + p2.lat) / 2;
      const midLng = (p1.lng + p2.lng) / 2;

      // Open popup with results
      const popup = L.popup({
        closeButton: false,
        className: 'tactical-measure-popup'
      })
        .setLatLng([midLat, midLng])
        .setContent(`
          <div style="background:#09090b; border:1px solid #22d3ee; color:#22d3ee; font-family:monospace; padding:6px 10px; font-size:11px; border-radius:4px; box-shadow:0 0 10px rgba(34,211,238,0.25);">
            <div style="font-weight:bold; font-size:11px; margin-bottom:4px; border-bottom:1px solid rgba(34,211,238,0.2); padding-bottom:3px; text-transform:uppercase; letter-spacing:0.05em;">📐 LOGISTICS CALCULATION</div>
            <b>SPAN:</b> ${miles.toFixed(3)} mi / ${kilometers.toFixed(3)} km<br/>
            <b>AZIMUTH:</b> ${calculateAzimuth(p1, p2).toFixed(1)}°
          </div>
        `)
        .openOn(map);

      measurePopupRef.current = popup;

      setMeasurementResult({
        distanceMeters,
        miles,
        kilometers,
        coords: [p1, p2]
      });

      logToTerminal(`>>> LOGISTICS COMPLETED: SPAN MEASURED AT ${miles.toFixed(3)} MILES (${kilometers.toFixed(3)} KM)`);
    }
  };

  // Sync handler to Ref for event listener bypass
  useEffect(() => {
    handleMeasureClickRef.current = handleMeasureClick;
  });

  // Export current routing vector & logistics measurement as JSON
  const handleExportTacticalTelemetry = () => {
    let routingVectorData: any = null;
    if (targetCoords) {
      const latlng1 = L.latLng(currentCoords.lat, currentCoords.lng);
      const latlng2 = L.latLng(targetCoords.lat, targetCoords.lng);
      const distMeters = latlng1.distanceTo(latlng2);
      const miles = distMeters * 0.000621371;
      const kilometers = distMeters / 1000;
      const azimuth = calculateAzimuth(currentCoords, targetCoords);

      routingVectorData = {
        status: "ACTIVE",
        origin: { lat: currentCoords.lat, lng: currentCoords.lng },
        destination: { lat: targetCoords.lat, lng: targetCoords.lng },
        distanceMiles: parseFloat(miles.toFixed(4)),
        distanceKilometers: parseFloat(kilometers.toFixed(4)),
        azimuthDegrees: parseFloat(azimuth.toFixed(2))
      };
    } else {
      routingVectorData = {
        status: "INACTIVE",
        origin: { lat: currentCoords.lat, lng: currentCoords.lng },
        destination: null,
        distanceMiles: 0,
        distanceKilometers: 0,
        azimuthDegrees: 0
      };
    }

    let logisticsRulerData: any = null;
    if (measurementResult) {
      logisticsRulerData = {
        status: "COMPLETED",
        pointA: { lat: measurementResult.coords[0].lat, lng: measurementResult.coords[0].lng },
        pointB: { lat: measurementResult.coords[1].lat, lng: measurementResult.coords[1].lng },
        distanceMiles: parseFloat(measurementResult.miles.toFixed(4)),
        distanceKilometers: parseFloat(measurementResult.kilometers.toFixed(4)),
        azimuthDegrees: parseFloat(calculateAzimuth(measurementResult.coords[0], measurementResult.coords[1]).toFixed(2))
      };
    } else {
      logisticsRulerData = {
        status: "INACTIVE",
        pointA: null,
        pointB: null,
        distanceMiles: 0,
        distanceKilometers: 0,
        azimuthDegrees: 0
      };
    }

    const payload = {
      timestamp: new Date().toISOString(),
      routingVector: routingVectorData,
      logisticsRuler: logisticsRulerData,
      activeWeatherOverlay: activeWeatherLayer,
      operatorEmail: user?.email || "anonymous-recon"
    };

    // Print to browser developer console
    console.log("[TACTICAL TELEMETRY EXPORT]", payload);

    // Stream formatted output to virtual console
    logToTerminal(`>>> EXPORTED TELEMETRY TO DEV CONSOLE:`);
    logToTerminal(`    [ROUTING VECT] STATUS: ${routingVectorData.status}${routingVectorData.status === "ACTIVE" ? ` | SPAN: ${routingVectorData.distanceMiles} mi | AZIMUTH: ${routingVectorData.azimuthDegrees}°` : ""}`);
    logToTerminal(`    [LOGISTICS RULER] STATUS: ${logisticsRulerData.status}${logisticsRulerData.status === "COMPLETED" ? ` | SPAN: ${logisticsRulerData.distanceMiles} mi | AZIMUTH: ${logisticsRulerData.azimuthDegrees}°` : ""}`);
    logToTerminal(`    JSON Payload dumped to Browser Console.`);
  };

  // Helper to push text logs safely to virtual console
  const logToTerminal = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  };

  // Auth initialization
  useEffect(() => {
    initAuth(
      async (loggedInUser, retrievedToken) => {
        setUser(loggedInUser);
        setToken(retrievedToken);
        setNeedsAuth(false);
        logToTerminal(`SECURE UPLINK ESTABLISHED: ${loggedInUser.email}`);
      },
      () => {
        setNeedsAuth(true);
        logToTerminal(`>>> SYSTEM BOUND TO LOCAL PROXY (OAUTH OFFLINE)`);
      }
    );
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      logToTerminal(">>> LAUNCHING SECURE GOOGLE IDENTITY HANDSHAKE...");
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        logToTerminal(`>>> SUCCESS: Welcome Operative ${result.user.email}`);
      }
    } catch (err: any) {
      logToTerminal(`>>> AUTH ERROR: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Synchronous sync helpers called by child component
  const handleSyncFrequencies = (newFreqs: FrequencyRecord[]) => {
    setFrequencies(newFreqs);
    logToTerminal(`>>> INTEGRATED ${newFreqs.length} NEW HIGH-FREQUENCY MONITOR CHANNELS`);
  };

  const handleSyncTriage = (newTriage: TriageRecord[]) => {
    setTriageProtocols(newTriage);
    logToTerminal(`>>> INGESTED ${newTriage.length} BATTLEFIELD MEDICAL TRIAGE DIRECTIVES`);
  };

  // Dynamic dynamic search filtering
  useEffect(() => {
    if (cameraSearch.trim() === '') {
      setFilteredCameras(allCameras.slice(0, 48));
    } else {
      const q = cameraSearch.toLowerCase();
      const filtered = allCameras.filter(c =>
        c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      );
      setFilteredCameras(filtered.slice(0, 48));
    }
  }, [cameraSearch, allCameras]);

  // Load real-time weather and evaluate local hazards using OpenWeatherMap or Open-Meteo fallback
  const fetchWeather = async (lat: number, lng: number) => {
    setWeatherLoading(true);
    const apiKey = (import.meta as any).env.VITE_OPENWEATHER_API_KEY;

    if (apiKey && apiKey !== 'undefined' && apiKey.trim() !== '') {
      try {
        logToTerminal(`>>> METEOROLOGICAL ACQUISITION: REQUESTING OPENWEATHERMAP FEED...`);
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=imperial`);
        if (!res.ok) {
          throw new Error(`OpenWeather API error: HTTP ${res.status}`);
        }
        const data = await res.json();
        const temp = data.main?.temp ?? 70;
        const humidity = data.main?.humidity ?? 50;
        const windSpeed = data.wind?.speed ?? 0;
        const windDir = data.wind?.deg ?? 0;
        const condition = data.weather?.[0]?.description ?? 'Unknown';

        const hazards: string[] = [];
        if (temp > 95) hazards.push("EXTREME HEAT STRESS");
        if (temp < 32) hazards.push("FREEZING HAZARD");
        if (windSpeed > 18) hazards.push("HIGH WIND SHEAR");
        const lowerCondition = condition.toLowerCase();
        if (lowerCondition.includes('storm') || lowerCondition.includes('thunderstorm')) {
          hazards.push("ELECTRICAL STORM");
        } else if (lowerCondition.includes('snow') || lowerCondition.includes('blizzard')) {
          hazards.push("ACCUMULATING SNOWFALL");
        } else if (lowerCondition.includes('rain') || lowerCondition.includes('drizzle')) {
          hazards.push("ACTIVE PRECIPITATION");
        }

        setWeather({
          temp: Math.round(temp),
          humidity,
          windSpeed: Math.round(windSpeed),
          windDir,
          condition: condition.toUpperCase(),
          hazardStatus: hazards.length > 1 ? 'CRITICAL' : hazards.length > 0 ? 'WARNING' : 'STABLE',
          hazardDetails: hazards,
          source: 'OpenWeatherMap'
        });
        logToTerminal(`>>> ATMOSPHERIC DATA SECURED: ${Math.round(temp)}°F • ${condition.toUpperCase()}`);
        setWeatherLoading(false);
        return;
      } catch (err: any) {
        logToTerminal(`>>> WEATHER ACQUISITION ERROR: ${err.message}. ROUTING BACKUP TELEMETRY...`);
      }
    }

    // Fallback to keyless Open-Meteo API
    try {
      logToTerminal(`>>> SECURING BACKUP SATELLITE ATMOSPHERIC LINK (OPEN-METEO)...`);
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`);
      if (!res.ok) throw new Error(`Open-Meteo link error: HTTP ${res.status}`);
      const data = await res.json();
      const curr = data.current;
      if (!curr) throw new Error("No current dataset in payload");

      const temp = curr.temperature_2m;
      const humidity = curr.relative_humidity_2m;
      const windSpeed = curr.wind_speed_10m;
      const windDir = curr.wind_direction_10m;
      const code = curr.weather_code;

      let condition = "CLEAR SKY";
      if (code >= 1 && code <= 3) condition = "PARTLY CLOUDY";
      else if (code >= 45 && code <= 48) condition = "FOG / OBSTRUCTED VISIBILITY";
      else if (code >= 51 && code <= 67) condition = "RAIN / OVERCAST DRIZZLE";
      else if (code >= 71 && code <= 77) condition = "SNOWFALL OBSERVED";
      else if (code >= 80 && code <= 82) condition = "SHOWERS INTERMITTENT";
      else if (code >= 95 && code <= 99) condition = "THUNDERSTORM THREAT";

      const hazards: string[] = [];
      if (temp > 95) hazards.push("EXTREME HEAT STRESS");
      if (temp < 32) hazards.push("FREEZING HAZARD");
      if (windSpeed > 18) hazards.push("HIGH WIND SHEAR");
      if (condition.includes("RAIN") || condition.includes("SHOWERS")) hazards.push("ACTIVE PRECIPITATION");
      if (condition.includes("THUNDERSTORM")) hazards.push("ELECTRICAL STORM");
      if (condition.includes("SNOW")) hazards.push("ACCUMULATING SNOWFALL");

      setWeather({
        temp: Math.round(temp),
        humidity,
        windSpeed: Math.round(windSpeed),
        windDir,
        condition: condition.toUpperCase(),
        hazardStatus: hazards.length > 1 ? 'CRITICAL' : hazards.length > 0 ? 'WARNING' : 'STABLE',
        hazardDetails: hazards,
        source: 'Open-Meteo Backup'
      });
      logToTerminal(`>>> BACKUP WEATHER LOCK STABILIZED: ${Math.round(temp)}°F • ${condition.toUpperCase()}`);
    } catch (err: any) {
      logToTerminal(`>>> ERROR: ATMOSPHERIC DATALINK OFFLINE: ${err.message}`);
    } finally {
      setWeatherLoading(false);
    }
  };

  // Load Georgia Department of Transportation CCTV Features
  const fetchGDOTCameras = async (centerLat: number, centerLng: number, targetMap?: any) => {
    logToTerminal(">>> QUERYING GEORGIA CAMERA GRID SERVICES...");
    const gdotUrl = "https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services/GDOT_Live_Traffic_Cameras/FeatureServer/0/query?where=1=1&outFields=cctv_id,name,location_description,url&outSR=4326&f=json";
    
    try {
      const res = await fetch(gdotUrl);
      if (!res.ok) throw new Error("GDOT stream directory unresponsive");
      const data = await res.json();
      
      if (data && data.features) {
        const parsed: CameraData[] = data.features.map((f: any) => {
          const attr = f.attributes;
          const geom = f.geometry || { x: centerLng, y: centerLat };
          let secureUrl = attr.url ? attr.url.replace("http://", "https://") : "";
          return {
            id: attr.cctv_id || attr.name || Math.random().toString(),
            name: attr.location_description || attr.name || 'GDOT Traffic Sensor',
            url: secureUrl,
            lat: typeof geom.y === 'number' ? geom.y : centerLat,
            lng: typeof geom.x === 'number' ? geom.x : centerLng
          };
        }).filter((cam: CameraData) => cam.url && !isNaN(cam.lat) && !isNaN(cam.lng));

        setAllCameras(parsed);
        setFilteredCameras(parsed.slice(0, 48));
        logToTerminal(`>>> SYNCHRONIZED ${parsed.length} GDOT EMERGENCY SENSORS`);
        
        // Populate markers to map if map loaded and matches current active map instance
        const activeMap = targetMap || mapInstanceRef.current;
        if (activeMap && mapInstanceRef.current === activeMap) {
          parsed.slice(0, 150).forEach((cam) => {
            const camIcon = L.divIcon({
              html: `<div style="background:#09090b; border:1.5px solid #10b981; width:12px; height:12px; border-radius:50%; box-shadow:0 0 4px #10b981;"></div>`,
              className: 'cam-pin',
              iconSize: [12, 12]
            });

            L.marker([cam.lat, cam.lng], { icon: camIcon })
              .addTo(activeMap)
              .bindPopup(
                `<div style="background:#09090b; color:#10b981; font-family:monospace; padding:4px; max-width:260px;">
                  <strong style="color:white; font-size:11px;">CAM // ${cam.id}</strong><br/>
                  <span style="font-size:10px; color:#a1a1aa; margin-bottom:4px; display:block;">${cam.name}</span>
                  <img src="${cam.url}" style="width:240px; aspect-ratio:16/9; border:1px solid #27272a; border-radius:2px;" alt="Feed Lost" />
                  <div style="font-size:9px; color:#71717a; margin-top:3px;">LAT: ${cam.lat.toFixed(4)} • LNG: ${cam.lng.toFixed(4)}</div>
                </div>`
              );
          });
        }
      }
    } catch (err: any) {
      logToTerminal(`>>> CAMERA RECON FAILED: ${err.message}`);
    }
  };

  // Load Leaflet and initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let isMounted = true;

    // Instantiate Map
    const map = L.map(mapContainerRef.current, { preferCanvas: true }).setView([currentCoords.lat, currentCoords.lng], 13);
    
    // Use premium dark tactical tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    mapInstanceRef.current = map;
    logToTerminal(">>> TACTICAL MAP CONTAINER RENDERED");

    // Place operator marker
    const opIcon = L.divIcon({
      html: `<div class="relative flex items-center justify-center">
               <span class="absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
               <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-neutral-950"></span>
             </div>`,
      className: 'operator-pulse',
      iconSize: [16, 16]
    });

    const opMarker = L.marker([currentCoords.lat, currentCoords.lng], { icon: opIcon })
      .addTo(map)
      .bindPopup('<b class="font-mono text-emerald-400">OPERATIVE LATITUDE LOCK</b>');

    positionMarkerRef.current = opMarker;

    // Ask for high-accuracy GPS
    if (navigator.geolocation) {
      logToTerminal("ACQUIRING DEVICE SENSOR LOCKS...");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!isMounted) return;
          const gpsLat = pos.coords.latitude;
          const gpsLng = pos.coords.longitude;
          const newPos = { lat: gpsLat, lng: gpsLng };
          setCurrentCoords(newPos);
          map.setView([gpsLat, gpsLng], 14);

          if (opMarker) {
            opMarker.setLatLng([gpsLat, gpsLng]);
          }
          logToTerminal(`>>> GRID ACQUIRED: LAT ${gpsLat.toFixed(5)} • LNG ${gpsLng.toFixed(5)}`);
          fetchGDOTCameras(gpsLat, gpsLng, map);
          fetchWeather(gpsLat, gpsLng);
        },
        (err) => {
          if (!isMounted) return;
          logToTerminal(">>> GEOLOCATION DENIED OR FAULTY. USING ATLAS COORDS.");
          fetchGDOTCameras(33.7490, -84.3880, map);
          fetchWeather(33.7490, -84.3880);
        },
        { enableHighAccuracy: true }
      );
    } else {
      fetchGDOTCameras(33.7490, -84.3880, map);
      fetchWeather(33.7490, -84.3880);
    }

    // Bind click listener for distance measurement
    map.on('click', (e: any) => {
      if (isMeasuringModeRef.current) {
        if (handleMeasureClickRef.current) {
          handleMeasureClickRef.current(e.latlng, map);
        }
      }
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current === map) {
        map.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync / Invalidate Leaflet map layout sizes whenever activeTab changes to 'map'
  useEffect(() => {
    if (activeTab === 'map' && mapInstanceRef.current) {
      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // OpenWeatherMap radar and weather layer projector
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (weatherLayerRef.current) {
      map.removeLayer(weatherLayerRef.current);
      weatherLayerRef.current = null;
    }

    if (activeWeatherLayer === 'none') return;

    const apiKey = (import.meta as any).env.VITE_OPENWEATHER_API_KEY;
    if (!apiKey || apiKey === 'undefined' || apiKey.trim() === '') {
      logToTerminal(">>> RADAR OVERLAY REJECTED: OpenWeatherMap API key (VITE_OPENWEATHER_API_KEY) is required in .env for active imagery.");
      setActiveWeatherLayer('none');
      return;
    }

    logToTerminal(`>>> RADAR OVERLAY ACTIVATED: PROJECTING ${activeWeatherLayer.toUpperCase()} MAP GRID`);

    let layerCode = 'precipitation_new';
    if (activeWeatherLayer === 'clouds') layerCode = 'clouds_new';
    else if (activeWeatherLayer === 'temp') layerCode = 'temp_new';
    else if (activeWeatherLayer === 'wind') layerCode = 'wind_new';

    const tileUrl = `https://tile.openweathermap.org/map/${layerCode}/{z}/{x}/{y}.png?appid=${apiKey}`;
    const newLayer = L.tileLayer(tileUrl, {
      maxZoom: 18,
      opacity: 0.6,
      attribution: 'Weather &copy; OpenWeatherMap'
    });

    newLayer.addTo(map);
    weatherLayerRef.current = newLayer;

    return () => {
      if (weatherLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(weatherLayerRef.current);
        weatherLayerRef.current = null;
      }
    };
  }, [activeWeatherLayer]);

  // Render atmospheric hazard zone circle on map based on actual/backup weather triggers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (weatherCircleRef.current) {
      map.removeLayer(weatherCircleRef.current);
      weatherCircleRef.current = null;
    }

    if (weather && weather.hazardDetails && weather.hazardDetails.length > 0) {
      const isCritical = weather.hazardStatus === 'CRITICAL';
      const color = isCritical ? '#ef4444' : '#f59e0b';
      const fillColor = isCritical ? '#ef4444' : '#f59e0b';
      
      const center: [number, number] = targetCoords 
        ? [targetCoords.lat, targetCoords.lng] 
        : [currentCoords.lat, currentCoords.lng];

      const circle = L.circle(center, {
        radius: 1609, // 1 Mile Tactical Buffer Area
        color: color,
        weight: 1.5,
        fillColor: fillColor,
        fillOpacity: 0.08,
        dashArray: '4, 8'
      }).addTo(map);

      circle.bindPopup(`
        <div style="background:#0a0a0a; border: 1px solid ${color}; color:${color}; font-family:monospace; padding:6px; font-size:11.5px; border-radius:4px; max-width: 240px;">
          <b style="text-transform:uppercase; font-size:12px; display:block; margin-bottom:4px; border-b: 1px solid ${color}33;">⚠️ ENVIRONMENTAL RISK SEGMENT</b>
          <span style="color:#f4f4f5; display:block; margin-bottom:2px;"><b>RISK:</b> ${weather.hazardStatus}</span>
          <span style="color:#d4d4d8; display:block; margin-bottom:2px;"><b>HAZARDS:</b> ${weather.hazardDetails.join(', ')}</span>
          <span style="color:#a1a1aa; font-size:10px; display:block; margin-top:4px;"><b>ACTUALS:</b> ${weather.temp}°F | ${weather.windSpeed} MPH Wind (${weather.windDir}°)</span>
        </div>
      `);

      weatherCircleRef.current = circle;
    }
  }, [weather, targetCoords, currentCoords]);

  // Compute navigation line vector when targeting coords
  const drawRoutingVector = (target: Coordinates) => {
    if (!mapInstanceRef.current) return;

    // Erase old route if present
    if (polylineRef.current) {
      mapInstanceRef.current.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    if (targetMarkerRef.current) {
      mapInstanceRef.current.removeLayer(targetMarkerRef.current);
      targetMarkerRef.current = null;
    }

    // Place distress beacon with pulse sweep design
    const beaconIcon = L.divIcon({
      html: `<div class="relative flex items-center justify-center">
               <span class="absolute inline-flex h-12 w-12 rounded-full bg-rose-500 opacity-40 animate-ping"></span>
               <span class="relative inline-flex rounded-full h-4 w-4 bg-rose-600 border border-white"></span>
             </div>`,
      className: 'beacon-ping',
      iconSize: [48, 48]
    });

    const targetMarker = L.marker([target.lat, target.lng], { icon: beaconIcon })
      .addTo(mapInstanceRef.current)
      .bindPopup('<b class="font-mono text-rose-500">DISTRESS TARGET INTERCEPT VECTOR</b>');

    targetMarkerRef.current = targetMarker;

    // Compute direct tactical route line
    const routeLine = L.polyline(
      [[currentCoords.lat, currentCoords.lng], [target.lat, target.lng]],
      { color: '#ef4444', weight: 3, dashArray: '8, 8', opacity: 0.85 }
    ).addTo(mapInstanceRef.current);

    polylineRef.current = routeLine;

    // Fit views to frame
    mapInstanceRef.current.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
    
    // Auto output route link for easy driver routing
    logToTerminal(`>>> EMERGENCY INTERCEPT VECTOR CONFIGURED [${target.lat}, ${target.lng}]`);
    logToTerminal(`[SYSTEM] Emergency routing dispatch ready.`);
  };

  const handleManualPlot = () => {
    if (!manualInput) return;
    const parts = manualInput.split(',');
    if (parts.length === 2) {
      const parsedLat = parseFloat(parts[0].trim());
      const parsedLng = parseFloat(parts[1].trim());
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        const target: Coordinates = { lat: parsedLat, lng: parsedLng };
        setTargetCoords(target);
        drawRoutingVector(target);
        fetchWeather(parsedLat, parsedLng);
      } else {
        logToTerminal(">>> ERROR: Coordinates parse resulted in NaN.");
      }
    } else {
      logToTerminal(">>> ERROR: Formatting constraint violated. Use 'LAT, LNG'");
    }
  };

  const focusCameraOnMap = (cam: CameraData) => {
    setActiveTab('map');
    const target: Coordinates = { lat: cam.lat, lng: cam.lng };
    setTargetCoords(target);
    
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.setView([cam.lat, cam.lng], 16);
        drawRoutingVector(target);
      }
    }, 150);
    
    logToTerminal(`>>> LOCKED DISPLAY FEEDS ON CHANNEL: CAM-${cam.id}`);
    fetchWeather(cam.lat, cam.lng);
  };

  // Simple terminal command line execution
  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCommand.trim()) return;
    
    const cmd = customCommand.trim().toUpperCase();
    logToTerminal(`> ${cmd}`);
    
    if (cmd === 'CLEAR') {
      setTerminalLogs([]);
    } else if (cmd.startsWith('PLOT ')) {
      const coordsPart = cmd.substring(5);
      const parts = coordsPart.split(',');
      if (parts.length === 2) {
        const parsedLat = parseFloat(parts[0].trim());
        const parsedLng = parseFloat(parts[1].trim());
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          const target = { lat: parsedLat, lng: parsedLng };
          setTargetCoords(target);
          drawRoutingVector(target);
          fetchWeather(parsedLat, parsedLng);
        } else {
          logToTerminal(">>> ERROR: Non-numeric coordinate payload");
        }
      }
    } else if (cmd === 'GPS') {
      if (positionMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.setView([currentCoords.lat, currentCoords.lng], 15);
        logToTerminal(`>>> POSITION ACQUIRED: ${currentCoords.lat}, ${currentCoords.lng}`);
        fetchWeather(currentCoords.lat, currentCoords.lng);
      }
    } else if (cmd === 'WEATHER' || cmd === 'METEOR') {
      const activeLoc = targetCoords || currentCoords;
      logToTerminal(`>>> MANUAL POLL: RE-FETCHING WEATHER DATA FOR LAT ${activeLoc.lat.toFixed(4)} • LNG ${activeLoc.lng.toFixed(4)}`);
      fetchWeather(activeLoc.lat, activeLoc.lng);
    } else {
      logToTerminal(`>>> UNKNOWN PROTOCOL: ${cmd}. COMMANDS: PLOT LAT,LNG | GPS | WEATHER | CLEAR`);
    }

    setCustomCommand('');
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-neutral-100 font-mono selection:bg-emerald-500/30 selection:text-emerald-400">
      
      {/* GLOBAL HEADER HEADER */}
      <header className="bg-neutral-950 border-b border-emerald-500/20 px-5 py-3 flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest font-display text-emerald-400">
              W.O.L.F. TACTICAL GRID OVERWATCH
            </h1>
            <p className="text-[10px] text-neutral-400">
              LOGISTICS PORTAL • INTEGRATED SAFETY OVERLAY
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest">
              GRID SECURED
            </span>
          </div>

          <div className="text-[10px] text-neutral-400 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded">
            LAT: {currentCoords.lat.toFixed(4)} • LNG: {currentCoords.lng.toFixed(4)}
          </div>
        </div>
      </header>

      {/* CORE NAVIGATION DECK */}
      <nav className="bg-neutral-900 border-b border-neutral-800 flex overflow-x-auto divide-x divide-neutral-800">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wider font-semibold border-b-2 transition ${
            activeTab === 'map'
              ? 'border-emerald-500 text-emerald-400 bg-neutral-950/40'
              : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-950/20'
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          Tactical Map
        </button>
        <button
          onClick={() => setActiveTab('cameras')}
          className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wider font-semibold border-b-2 transition ${
            activeTab === 'cameras'
              ? 'border-emerald-500 text-emerald-400 bg-neutral-950/40'
              : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-950/20'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          Optical Feeds
        </button>
        <button
          onClick={() => setActiveTab('comms')}
          className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wider font-semibold border-b-2 transition ${
            activeTab === 'comms'
              ? 'border-emerald-500 text-emerald-400 bg-neutral-950/40'
              : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-950/20'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          Command Center
        </button>
        <button
          onClick={() => setActiveTab('triage')}
          className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wider font-semibold border-b-2 transition ${
            activeTab === 'triage'
              ? 'border-rose-500 text-rose-500 bg-neutral-950/40'
              : 'border-transparent text-neutral-400 hover:text-rose-400 hover:bg-neutral-950/20'
          }`}
        >
          <ActivitySquare className="w-3.5 h-3.5 text-rose-500" />
          ⚕️ Triage Guides
        </button>
      </nav>

      {/* VIEW CONTROLLER AREA */}
      <main className="flex-1 overflow-hidden relative">
        
        {/* TACTICAL MAP CONTAINER */}
        <div className={`w-full h-full flex flex-col ${activeTab === 'map' ? 'block' : 'hidden'} ${isMeasuringMode ? 'measuring-cursor' : ''}`}>
          <div className="flex-1 relative bg-neutral-950">
            <div ref={mapContainerRef} className="w-full h-full z-10" />
            
            {/* OVERLAY TACTICAL RECON CARD */}
            <div className="absolute top-4 right-4 z-20 w-80 bg-neutral-950/90 backdrop-blur-md border border-emerald-500/30 p-4 rounded-lg shadow-2xl hidden md:block">
              <div className="flex items-center gap-1.5 border-b border-emerald-500/10 pb-2 mb-3">
                <Compass className="w-4 h-4 text-emerald-400 animate-spin" />
                <h3 className="font-bold text-[11px] text-emerald-400 uppercase tracking-widest font-display">
                  SITUATIONAL RECON TELEMETRY
                </h3>
              </div>

              <div className="space-y-3.5">
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase font-mono">OPERATIVE LOCATION</span>
                  <span className="text-[11px] text-emerald-500 block font-semibold mt-0.5 font-mono">
                    {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
                  </span>
                </div>

                {targetCoords ? (
                  <div>
                    <span className="text-[10px] text-rose-500 block uppercase font-mono flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-500 animate-pulse" />
                      DISTRESS SIGNAL CAPTURE
                    </span>
                    <span className="text-[11px] text-rose-400 block font-semibold mt-0.5 font-mono">
                      {targetCoords.lat.toFixed(5)}, {targetCoords.lng.toFixed(5)}
                    </span>
                    <div className="mt-2">
                      <a
                        href={`https://waze.com/ul?ll=${targetCoords.lat},${targetCoords.lng}&navigate=yes`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-rose-500 text-neutral-950 text-[10px] font-bold uppercase px-3 py-1.5 rounded hover:bg-rose-400 transition shadow"
                      >
                        <Navigation className="w-3 h-3" />
                        EMERGENCY WAZE OVERLAY
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-neutral-500 bg-neutral-900/50 p-2 border border-neutral-800 rounded text-center italic font-mono">
                    No active distress signals. GRID is stable.
                  </div>
                )}

                {/* ATMOSPHERIC RISK SEGMENT */}
                <div className="border-t border-emerald-500/10 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-neutral-500 block uppercase font-mono">ATMOSPHERIC RECON</span>
                    {weatherLoading ? (
                      <span className="text-[9px] text-emerald-400 animate-pulse font-mono font-semibold uppercase">SCANNING...</span>
                    ) : weather ? (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                        weather.hazardStatus === 'CRITICAL' ? 'bg-red-500/10 border border-red-500/30 text-red-400 animate-pulse' :
                        weather.hazardStatus === 'WARNING' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' :
                        'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      }`}>
                        {weather.hazardStatus}
                      </span>
                    ) : null}
                  </div>

                  {weather ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 bg-neutral-900/40 p-2 border border-neutral-900 rounded">
                        <div className="text-center">
                          <Thermometer className="w-3.5 h-3.5 text-orange-400 mx-auto mb-1" />
                          <span className="text-[9px] text-neutral-500 block uppercase font-mono">TEMP</span>
                          <span className="text-[10px] font-bold text-white font-mono">{weather.temp}°F</span>
                        </div>
                        <div className="text-center">
                          <Wind className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-1" />
                          <span className="text-[9px] text-neutral-500 block uppercase font-mono">WIND</span>
                          <span className="text-[10px] font-bold text-white font-mono">{weather.windSpeed} mph</span>
                        </div>
                        <div className="text-center">
                          <Droplets className="w-3.5 h-3.5 text-blue-400 mx-auto mb-1" />
                          <span className="text-[9px] text-neutral-500 block uppercase font-mono">HUMIDITY</span>
                          <span className="text-[10px] font-bold text-white font-mono">{weather.humidity}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] bg-neutral-900/60 px-2 py-1 rounded border border-neutral-900">
                        <span className="text-neutral-400 font-mono">COND: <b className="text-neutral-200">{weather.condition}</b></span>
                        <span className="text-[9px] text-neutral-600 font-mono">{weather.source}</span>
                      </div>

                      {weather.hazardDetails.length > 0 && (
                        <div className="bg-red-950/20 border border-red-500/20 rounded p-1.5 text-[9.5px] text-red-400 font-mono flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
                          <div>
                            <span className="font-bold">HAZARDS DETECTED:</span>
                            <div className="text-red-300 font-medium leading-tight mt-0.5">
                              {weather.hazardDetails.join(' • ')}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[9.5px] text-neutral-500 italic font-mono text-center bg-neutral-900/30 py-2 border border-neutral-900 rounded">
                      Retrieving meteorological satellite locks...
                    </div>
                  )}
                </div>

                {/* LOGISTICS MEASUREMENT RULER */}
                <div className="border-t border-emerald-500/10 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-neutral-500 block uppercase font-mono flex items-center gap-1">
                      <Ruler className="w-3.5 h-3.5 text-cyan-400" />
                      LOGISTICS RULER
                    </span>
                    <button
                      onClick={() => {
                        const nextState = !isMeasuringMode;
                        setIsMeasuringMode(nextState);
                        if (nextState) {
                          clearMeasurement();
                          logToTerminal(">>> LOGISTICS RULER ACTIVE: CLICK TWO POINTS ON THE MAP TO MEASURE DISTANCE");
                        } else {
                          logToTerminal(">>> LOGISTICS RULER STANDBY");
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition border ${
                        isMeasuringMode
                          ? 'bg-cyan-500/15 border-cyan-500 text-cyan-400 animate-pulse'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                      }`}
                    >
                      {isMeasuringMode ? '● ACTIVE' : 'OFFLINE'}
                    </button>
                  </div>

                  {measurementResult ? (
                    <div className="space-y-2 bg-neutral-900/40 p-2 border border-neutral-900 rounded">
                      <div className="flex items-center justify-between text-[10.5px] font-mono">
                        <span className="text-neutral-500">SPAN DISTANCE:</span>
                        <span className="text-cyan-400 font-bold">{measurementResult.miles.toFixed(3)} mi</span>
                      </div>
                      <div className="flex items-center justify-between text-[10.5px] font-mono border-t border-neutral-900/50 pt-1">
                        <span className="text-neutral-500">METRIC SPAN:</span>
                        <span className="text-neutral-300 font-semibold">{measurementResult.kilometers.toFixed(3)} km</span>
                      </div>
                      <div className="flex items-center justify-between text-[10.5px] font-mono border-t border-neutral-900/50 pt-1">
                        <span className="text-neutral-500">GRID AZIMUTH:</span>
                        <span className="text-neutral-300 font-semibold">
                          {calculateAzimuth(measurementResult.coords[0], measurementResult.coords[1]).toFixed(1)}°
                        </span>
                      </div>
                      <button
                        onClick={clearMeasurement}
                        className="w-full mt-1 py-1 text-[9px] font-mono font-bold uppercase bg-cyan-950/20 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500 rounded transition"
                      >
                        PURGE MEASUREMENT
                      </button>
                    </div>
                  ) : (
                    <div className="text-[9px] text-neutral-500 italic font-mono text-center bg-neutral-900/30 py-2 border border-neutral-900 rounded">
                      {isMeasuringMode
                        ? 'Click two points on the tactical map...'
                        : 'Standby. Toggle active to compute vectors.'}
                    </div>
                  )}
                </div>

                {/* TACTICAL WEATHER RADAR CONTROLS */}
                <div className="border-t border-emerald-500/10 pt-3">
                  <span className="text-[10px] text-neutral-500 block uppercase font-mono mb-2">TACTICAL OVERLAYS</span>
                  <div className="grid grid-cols-5 gap-1">
                    {(['none', 'precipitation', 'clouds', 'temp', 'wind'] as const).map((layer) => (
                      <button
                        key={layer}
                        onClick={() => setActiveWeatherLayer(layer)}
                        className={`py-1 text-[8px] font-mono font-bold uppercase rounded border transition ${
                          activeWeatherLayer === layer
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                            : 'bg-neutral-900/50 border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-700'
                        }`}
                        title={`Toggle ${layer === 'none' ? 'Standard Tactical Grid' : layer.toUpperCase() + ' Overlay'}`}
                      >
                        {layer === 'precipitation' ? 'RAIN' : layer}
                      </button>
                    ))}
                  </div>
                  <span className="text-[8px] text-neutral-600 block mt-1.5 leading-tight font-mono">
                    * RAIN/WIND/TEMP radar overlays require a valid OpenWeatherMap API key. Fallback satellite metrics are keyless.
                  </span>
                </div>

                {/* COORDINATION EXPORT SEGMENT */}
                <div className="border-t border-emerald-500/10 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-neutral-500 block uppercase font-mono">EXTERNAL COORDINATION</span>
                  </div>
                  <button
                    onClick={handleExportTacticalTelemetry}
                    className="w-full py-1.5 text-[9.5px] font-mono font-bold uppercase bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 rounded transition flex items-center justify-center gap-1.5 shadow-sm"
                    title="Export vector telemetry payload to system dev console"
                  >
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    EXPORT TELEMETRY PAYLOAD
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* QUICK PLOT CONTROL BAR */}
          <div className="bg-neutral-900 border-t border-neutral-800 p-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="PLOT MANUALLY (e.g., '33.754, -84.381')..."
                className="w-full bg-neutral-950 border border-emerald-500/20 text-emerald-400 placeholder-neutral-600 font-mono text-xs px-4 py-3 rounded outline-none focus:border-emerald-500/60"
              />
            </div>
            <button
              onClick={handleManualPlot}
              className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold uppercase px-6 py-3 rounded transition flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              PLOT VECTOR
            </button>
          </div>
        </div>

        {/* OPTICAL CAMERAS GRID */}
        <div className={`w-full h-full ${activeTab === 'cameras' ? 'block' : 'hidden'}`}>
          <CameraFeed
            cameras={filteredCameras}
            onFocusOnMap={focusCameraOnMap}
            searchTerm={cameraSearch}
            onSearchChange={setCameraSearch}
          />
        </div>

        {/* COMMAND CENTER & AUDIO MONITORS */}
        <div className={`w-full h-full overflow-y-auto p-5 space-y-6 ${activeTab === 'comms' ? 'block' : 'hidden'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* GOOGLE WORKSPACE DATA EXCHANGER */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  WORKSPACE OPERATIONS & DIRECTORIES
                </h2>
                <WorkspaceSync
                  accessToken={token}
                  onLogin={handleLogin}
                  userEmail={user?.email || undefined}
                  onSyncFrequencies={handleSyncFrequencies}
                  onSyncTriage={handleSyncTriage}
                  onLogMessage={logToTerminal}
                />
              </div>

              <div>
                <AudioFrequencyScanner
                  frequencies={frequencies}
                  onLogMessage={logToTerminal}
                />
              </div>
            </div>

            {/* VIRTUAL TERMINAL & DIAGNOSTIC PANEL */}
            <div className="lg:col-span-7 flex flex-col h-full min-h-[400px]">
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                INTELLIGENCE DIAGNOSTIC CONSOLE
              </h2>
              
              <div className="flex-grow bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex flex-col overflow-hidden">
                <div className="flex-grow overflow-y-auto space-y-1.5 text-[11px] text-neutral-400 font-mono mb-4 max-h-[350px] custom-scrollbar">
                  {terminalLogs.map((log, idx) => {
                    let textClass = 'text-neutral-400';
                    if (log.includes('CRITICAL') || log.includes('ERROR')) {
                      textClass = 'text-rose-500 font-bold';
                    } else if (log.includes('SUCCESS') || log.includes('GRID')) {
                      textClass = 'text-emerald-400 font-medium';
                    } else if (log.includes('[RADIO INTERCEPT]')) {
                      textClass = 'text-amber-400';
                    }
                    return (
                      <div key={idx} className={`${textClass} leading-relaxed`}>
                        {log}
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleSendCommand} className="flex gap-2 border-t border-neutral-900 pt-3">
                  <span className="text-emerald-400 flex items-center text-xs font-bold">&gt;</span>
                  <input
                    type="text"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    placeholder="ENTER PROTOCOLS (e.g. 'GPS', 'CLEAR', 'PLOT lat,lng')..."
                    className="flex-grow bg-transparent text-emerald-400 placeholder-neutral-700 outline-none border-none text-xs font-mono"
                  />
                  <button type="submit" className="text-neutral-500 hover:text-emerald-400 transition p-1">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>

        {/* TACTICAL MEDICAL TRIAGE LIST */}
        <div className={`w-full h-full ${activeTab === 'triage' ? 'block' : 'hidden'}`}>
          <MedicalTriage
            triageProtocols={triageProtocols}
            searchTerm={triageSearch}
            onSearchChange={setTriageSearch}
          />
        </div>

      </main>
    </div>
  );
}
