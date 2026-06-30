import React from 'react';
import { Camera, MapPin, Eye, ExternalLink } from 'lucide-react';
import { CameraData } from '../types';

interface CameraFeedProps {
  cameras: CameraData[];
  onFocusOnMap: (cam: CameraData) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({
  cameras,
  onFocusOnMap,
  searchTerm,
  onSearchChange,
}) => {
  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-200">
      <div className="p-4 border-b border-emerald-500/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wider font-display text-emerald-400 flex items-center gap-2">
            <Camera className="w-4 h-4" />
            GDOT TRAFFIC SENSORS & PUBLIC FEEDS
          </h2>
          <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
            REALTIME VISUAL PATROLS • STABILIZED HIGHWAYS
          </p>
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter sensor ID, highway, or description..."
          className="w-full sm:w-64 bg-neutral-900 border border-emerald-500/20 text-emerald-400 placeholder-neutral-500 text-xs px-3 py-2 rounded font-mono outline-none focus:border-emerald-500/60"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {cameras.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 border border-dashed border-neutral-800 rounded bg-neutral-900/30">
            <Eye className="w-8 h-8 text-neutral-600 mb-2 animate-pulse" />
            <span className="text-xs text-neutral-500 font-mono">NO ACTIVE STREAM CHANNELS MATCHING REQUEST</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cameras.map((cam) => {
              // Create an interesting dynamic fallback timestamp to bypass server cache if possible
              const liveUrl = `${cam.url}?t=${new Date().getMinutes()}`;
              return (
                <div
                  key={cam.id}
                  className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden flex flex-col group hover:border-emerald-500/30 transition-all duration-200"
                >
                  <div className="p-3 bg-neutral-950 flex justify-between items-center border-b border-neutral-800">
                    <div className="truncate pr-2">
                      <span className="text-[10px] text-emerald-500 font-mono block">CAM // {cam.id}</span>
                      <span className="text-xs font-semibold text-neutral-300 truncate font-mono block">{cam.name}</span>
                    </div>
                    <button
                      onClick={() => onFocusOnMap(cam)}
                      title="Plot Target Vector"
                      className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-neutral-950 p-1.5 rounded transition"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="relative aspect-video bg-neutral-950 flex items-center justify-center overflow-hidden border-b border-neutral-800">
                    <img
                      src={liveUrl}
                      alt={`Live optical feed for ${cam.name}`}
                      loading="lazy"
                      onError={(e) => {
                        // Prevent infinite retries
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=600&auto=format&fit=crop';
                      }}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2 bg-rose-600 text-[9px] font-bold text-white px-1.5 py-0.5 rounded tracking-widest font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                      LIVE FEEDS
                    </div>
                    <div className="absolute bottom-2 right-2 bg-neutral-950/80 backdrop-blur-xs text-[9px] text-neutral-400 font-mono px-2 py-0.5 rounded">
                      GDOT OPTICS
                    </div>
                  </div>

                  <div className="p-2.5 bg-neutral-900/60 mt-auto flex justify-between items-center text-[10px] font-mono text-neutral-500">
                    <span>LAT: {cam.lat.toFixed(4)} • LNG: {cam.lng.toFixed(4)}</span>
                    <a
                      href={cam.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-emerald-400 flex items-center gap-1 transition"
                    >
                      Raw
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
