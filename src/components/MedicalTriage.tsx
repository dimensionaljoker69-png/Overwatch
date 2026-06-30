import React from 'react';
import { ShieldAlert, ChevronRight, HeartHandshake } from 'lucide-react';
import { TriageRecord } from '../types';

interface MedicalTriageProps {
  triageProtocols: TriageRecord[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export const MedicalTriage: React.FC<MedicalTriageProps> = ({
  triageProtocols,
  searchTerm,
  onSearchChange,
}) => {
  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-200">
      <div className="p-4 border-b border-rose-500/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wider font-display text-rose-500 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            W.O.L.F. TACTICAL MEDICAL TRIAGE PROTOCOLS
          </h2>
          <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
            FIELD MEDICINE • SURVIVAL INDEX • EMERGENCY MANUALS
          </p>
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter protocols (CPR, Bleeding, Trauma)..."
          className="w-full sm:w-64 bg-neutral-900 border border-rose-500/20 text-rose-400 placeholder-neutral-500 text-xs px-3 py-2 rounded font-mono outline-none focus:border-rose-500/60"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {triageProtocols.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 border border-dashed border-neutral-800 rounded bg-neutral-900/30 text-center">
            <HeartHandshake className="w-8 h-8 text-neutral-600 mb-2 animate-pulse" />
            <span className="text-xs text-neutral-500 font-mono">NO COMPATIBLE TRIAGE INSTRUCTIONS CONFIGURED</span>
            <p className="text-[10px] text-neutral-600 font-mono max-w-xs mt-1">
              Sync with your Google Sheet in the Command Center to load updated medical databases.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {triageProtocols.map((protocol, idx) => {
              const priority = protocol.Priority_Calculation || 'STANDARD';
              const isCritical = priority.toLowerCase().includes('critical') || priority.toLowerCase().includes('1');

              return (
                <div
                  key={idx}
                  className={`bg-neutral-900 border rounded overflow-hidden shadow-sm transition duration-200 ${
                    isCritical ? 'border-rose-500/30 border-l-4 border-l-rose-500' : 'border-neutral-800 border-l-4 border-l-amber-500'
                  }`}
                >
                  <div className="p-4 bg-neutral-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800">
                    <div>
                      <h3 className="text-sm font-bold text-neutral-200 font-mono tracking-wide uppercase">
                        {protocol.Procedure_Title || 'UNKNOWN EMERGENCY'}
                      </h3>
                      <span className="text-[9px] text-neutral-500 font-mono uppercase mt-0.5 block">
                        Index Reference #{idx + 101}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-wider uppercase font-mono ${
                          isCritical
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {priority}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="text-xs text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {protocol.Instructions || 'No operational steps loaded.'}
                    </p>
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
