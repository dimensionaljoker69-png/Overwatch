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
  FileSpreadsheet
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

  // Map elements ref & local tracking
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const positionMarkerRef = useRef<any>(null);
  const targetMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const LRef = useRef<any>(null);

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
        },
        (err) => {
          if (!isMounted) return;
          logToTerminal(">>> GEOLOCATION DENIED OR FAULTY. USING ATLAS COORDS.");
          fetchGDOTCameras(33.7490, -84.3880, map);
        },
        { enableHighAccuracy: true }
      );
    } else {
      fetchGDOTCameras(33.7490, -84.3880, map);
    }

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
        } else {
          logToTerminal(">>> ERROR: Non-numeric coordinate payload");
        }
      }
    } else if (cmd === 'GPS') {
      if (positionMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.setView([currentCoords.lat, currentCoords.lng], 15);
        logToTerminal(`>>> POSITION ACQUIRED: ${currentCoords.lat}, ${currentCoords.lng}`);
      }
    } else {
      logToTerminal(`>>> UNKNOWN PROTOCOL: ${cmd}. COMMANDS: PLOT LAT,LNG | GPS | CLEAR`);
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
        <div className={`w-full h-full flex flex-col ${activeTab === 'map' ? 'block' : 'hidden'}`}>
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
