import React from 'react';
import { 
  Home, 
  Brain, 
  Database, 
  Users, 
  Box, 
  Wrench, 
  Settings 
} from 'lucide-react';
import { NavView } from '../types/jarvis';

interface HUDLeftNavProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
}

export const HUDLeftNav: React.FC<HUDLeftNavProps> = ({ currentView, onSelectView }) => {
  const menuItems: { id: NavView; label: string; tag: string; icon: React.ReactNode }[] = [
    { id: 'sala_principal', label: 'Sala Principal', tag: 'COCKPIT', icon: <Home className="w-4 h-4" /> },
    { id: 'hermes_agent', label: 'Hermes-Agent', tag: 'REASONING', icon: <Brain className="w-4 h-4 text-fuchsia-400" /> },
    { id: 'rakazo_memory', label: 'Rakazo Memoria', tag: 'BYOM', icon: <Database className="w-4 h-4 text-emerald-400" /> },
    { id: 'opengrok_team', label: 'OpenGrok Squad', tag: 'SQUAD', icon: <Users className="w-4 h-4 text-amber-400" /> },
    { id: 'laboratorio_3d', label: 'Laboratorio 3D', tag: 'POSES', icon: <Box className="w-4 h-4 text-cyan-400" /> },
    { id: 'herramientas', label: 'Herramientas', tag: 'ELECTRON', icon: <Wrench className="w-4 h-4" /> },
    { id: 'configuracion', label: 'Configuración', tag: 'SYSTEM', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <nav className="relative z-20 flex flex-col gap-1.5 w-60 p-3 rounded-xl bg-slate-950/98 border border-cyan-500/40 shadow-[0_0_30px_rgba(0,0,0,0.9)] pointer-events-auto">
      <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-cyan-400/80 px-2 py-1 uppercase border-b border-cyan-900/40 mb-1">
        <span>JARVIS TRINITY ENGINE</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
      </div>
      {menuItems.map((item) => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectView(item.id)}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              isActive
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.25)] translate-x-1'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/70 hover:border-slate-800 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-500">
              {item.tag}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
