import React from 'react';
import { Shield, Eye, BookOpen, Layers, Zap, Brain, Database, Users } from 'lucide-react';

interface HUDHeaderProps {
  currentEmotion: string;
  currentAction: string;
  cameraPreset: 'default' | 'closeup' | 'overview' | 'fullbody';
  setCameraPreset: (preset: 'default' | 'closeup' | 'overview' | 'fullbody') => void;
  onOpenElectronGuide: () => void;
  onOpen3DLab: () => void;
}

export const HUDHeader: React.FC<HUDHeaderProps> = ({
  cameraPreset,
  setCameraPreset,
  onOpenElectronGuide,
  onOpen3DLab,
}) => {
  return (
    <header className="relative z-30 flex items-center justify-between px-6 py-3.5 pointer-events-auto bg-slate-950/95 border-b border-cyan-500/30 shadow-[0_4px_25px_rgba(0,0,0,0.95)]">
      {/* Brand & Crest */}
      <div className="flex items-center gap-3.5">
        <div className="relative flex items-center justify-center w-11 h-11 rounded-lg bg-cyan-950/50 border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.35)]">
          <Shield className="w-6 h-6 text-cyan-400" />
          <div className="absolute inset-0 rounded-lg border border-cyan-300/30" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-fuchsia-400">
              JARVIS
            </h1>
            <span className="text-[11px] font-semibold tracking-widest px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
              AGENTE SUPREMO v3.0
            </span>
            <span className="hidden md:inline-flex text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300">
              ⚡ OPENGROK + RAKAZO + HERMES
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono tracking-wide flex items-center gap-2 mt-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            MOTOR AUTÓNOMO MULTI-AGENTE // ULTRA LIVIANO & RÁPIDO
          </p>
        </div>
      </div>

      {/* Center Camera Controls */}
      <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-lg bg-slate-900/90 border border-cyan-900/40">
        <span className="text-[11px] font-mono text-slate-400 px-2.5 flex items-center gap-1">
          <Eye className="w-3.5 h-3.5 text-cyan-400" /> CÁMARA:
        </span>
        {(['default', 'closeup', 'overview', 'fullbody'] as const).map((preset) => (
          <button
            key={preset}
            onClick={() => setCameraPreset(preset)}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              cameraPreset === preset
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {preset === 'default' ? 'Cabina' : preset === 'closeup' ? 'Rostro' : preset === 'overview' ? 'Panorámica' : 'Completo'}
          </button>
        ))}
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpen3DLab}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-950/60 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-400 transition-all shadow-[0_0_12px_rgba(6,182,212,0.15)]"
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Poses & Cinemática</span>
        </button>

        <button
          onClick={onOpenElectronGuide}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-fuchsia-950/60 border border-fuchsia-500/40 text-fuchsia-300 hover:bg-fuchsia-900/50 hover:border-fuchsia-400 transition-all shadow-[0_0_15px_rgba(236,72,153,0.2)]"
        >
          <BookOpen className="w-4 h-4 text-fuchsia-400" />
          <span>Electron + img2threejs</span>
        </button>
      </div>
    </header>
  );
};
