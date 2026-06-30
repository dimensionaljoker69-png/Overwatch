import React, { useEffect, useState, useRef } from 'react';
import { Play, Square, Volume2, Shield, Activity, RefreshCw } from 'lucide-react';
import { FrequencyRecord } from '../types';

interface AudioFrequencyScannerProps {
  frequencies: FrequencyRecord[];
  onLogMessage: (msg: string) => void;
}

export const AudioFrequencyScanner: React.FC<AudioFrequencyScannerProps> = ({ frequencies, onLogMessage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeFrequency, setActiveFrequency] = useState<FrequencyRecord | null>(null);
  const [volume, setVolume] = useState(0.2);
  const [scanningSpeed, setScanningSpeed] = useState(1500); // ms per hop
  const [scanIndex, setScanIndex] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Audio Context lazy
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
      const gainNode = audioCtxRef.current.createGain();
      gainNode.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
      gainNode.connect(audioCtxRef.current.destination);
      gainNodeRef.current = gainNode;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const startToneForFreq = (freqStr: string) => {
    if (!audioCtxRef.current || !gainNodeRef.current) return;

    // Stop current oscillator if any
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch (e) {}
    }

    // Parse numeric frequency or generate derivative of standard
    const baseFreqNum = parseFloat(freqStr.replace(/[^0-9.]/g, ''));
    // Map normal radio frequencies (like 154.280 MHz or 460.125 MHz) to pleasant low synth range (e.g. 200Hz - 600Hz)
    const synthFreq = 150 + ((baseFreqNum * 100) % 450);

    const osc = audioCtxRef.current.createOscillator();
    osc.type = 'sawtooth'; // rugged tactical tactical sound filter
    osc.frequency.setValueAtTime(synthFreq, audioCtxRef.current.currentTime);

    // Apply lowpass filter to make it sound like static radio squelch
    const filter = audioCtxRef.current.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, audioCtxRef.current.currentTime);

    // Squelch static simulation modulation
    const staticGain = audioCtxRef.current.createGain();
    staticGain.gain.setValueAtTime(0.3 + Math.random() * 0.4, audioCtxRef.current.currentTime);

    osc.connect(filter);
    filter.connect(staticGain);
    staticGain.connect(gainNodeRef.current);

    osc.start();
    oscillatorRef.current = osc;
  };

  const stopTone = () => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch (e) {}
      oscillatorRef.current = null;
    }
  };

  // Handle Play/Stop
  const handleToggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setActiveFrequency(null);
      stopTone();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      onLogMessage(">>> AUDIO MONITORING FEED DEACTIVATED");
    } else {
      initAudio();
      setIsPlaying(true);
      onLogMessage(">>> SCANNING INTEGRATED RADIO FREQUENCY MATRIX...");
    }
  };

  // Frequency Scanning cycle
  useEffect(() => {
    if (!isPlaying) return;

    const runScanner = () => {
      const nextIdx = (scanIndex + 1) % frequencies.length;
      setScanIndex(nextIdx);
      const freqObj = frequencies[nextIdx];
      setActiveFrequency(freqObj);

      // Random active hits
      const isActiveHit = Math.random() > 0.4;
      if (isActiveHit) {
        startToneForFreq(freqObj.frequency);
        onLogMessage(`[RADIO INTERCEPT] ${freqObj.channel} (${freqObj.frequency} MHz) - SQUELCH ACQUIRED: ${freqObj.description}`);
      } else {
        stopTone();
        onLogMessage(`[SCANNING] Monitoring frequency ${freqObj.frequency} MHz on ${freqObj.channel}...`);
      }
    };

    timerRef.current = setInterval(runScanner, scanningSpeed);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, scanIndex, frequencies, scanningSpeed]);

  // Handle Volume update
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
    }
  }, [volume]);

  // Stop sound on unmount
  useEffect(() => {
    return () => {
      stopTone();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="bg-neutral-900 border border-emerald-500/20 p-4 rounded-lg shadow-md font-mono text-xs">
      <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${isPlaying ? 'text-emerald-400 animate-pulse' : 'text-neutral-500'}`} />
          <span className="font-semibold text-emerald-400 tracking-wider">TACTICAL COMMS SCANNER</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            className={`px-3 py-1 rounded font-bold uppercase transition flex items-center gap-1.5 ${
              isPlaying 
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' 
                : 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="w-3 h-3" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                Scan
              </>
            )}
          </button>
        </div>
      </div>

      {activeFrequency && isPlaying ? (
        <div className="bg-neutral-950 border border-emerald-500/30 rounded p-3 mb-3 text-center transition-all duration-300">
          <div className="text-emerald-400 text-lg font-bold tracking-widest font-display">
            {activeFrequency.frequency} MHz
          </div>
          <div className="text-[10px] text-emerald-500/80 font-medium uppercase mt-0.5">
            CH: {activeFrequency.channel} | TYPE: {activeFrequency.type}
          </div>
          <div className="text-neutral-400 text-[11px] mt-1 italic truncate">
            "{activeFrequency.description}"
          </div>
        </div>
      ) : (
        <div className="bg-neutral-950 border border-neutral-800 rounded p-4 mb-3 text-center text-neutral-500 italic">
          Receiver idle. Press SCAN to lock frequencies.
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Volume2 className="w-3.5 h-3.5" />
            <span>Volume</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-grow accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Scan Delay</span>
          </div>
          <select
            value={scanningSpeed}
            onChange={(e) => setScanningSpeed(parseInt(e.target.value))}
            className="bg-neutral-950 border border-neutral-800 text-emerald-400 rounded px-2 py-0.5 outline-none text-[11px]"
          >
            <option value="800">Fast (0.8s)</option>
            <option value="1500">Standard (1.5s)</option>
            <option value="3000">Slow (3.0s)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
