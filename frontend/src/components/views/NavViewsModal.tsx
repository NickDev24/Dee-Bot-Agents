import React from 'react';
import { 
  X, 
  Brain, 
  Database, 
  Users, 
  Wrench, 
  Settings, 
  Zap, 
  Sliders 
} from 'lucide-react';
import { NavView } from '../../types/jarvis';
import { HermesAgentView } from './HermesAgentView';
import { RakazoMemoryView } from './RakazoMemoryView';
import { OpenGrokTeamView } from './OpenGrokTeamView';

interface NavViewsModalProps {
  currentView: NavView;
  onClose: () => void;
  onActionTrigger: (text: string) => void;
}

export const NavViewsModal: React.FC<NavViewsModalProps> = ({
  currentView,
  onClose,
  onActionTrigger,
}) => {
  if (currentView === 'sala_principal' || currentView === 'laboratorio_3d') return null;

  const getViewMeta = () => {
    switch (currentView) {
      case 'hermes_agent':
        return { title: 'HERMES-AGENT // AUTONOMOUS REASONING & TOOL CALLS', icon: Brain, color: 'text-fuchsia-400' };
      case 'rakazo_memory':
        return { title: 'RAKAZO MEMORY // VECTOR STORE & BYOM CONNECTORS', icon: Database, color: 'text-emerald-400' };
      case 'opengrok_team':
        return { title: 'OPENGROKBOT TEAM // MULTI-AGENT COLLABORATION SQUAD', icon: Users, color: 'text-amber-400' };
      case 'herramientas':
        return { title: 'HERRAMIENTAS // SUITE IMG2THREEJS & DESKTOP ELECTRON', icon: Wrench, color: 'text-cyan-400' };
      case 'configuracion':
        return { title: 'CONFIGURACIÓN // PARÁMETROS DEL SISTEMA & BYOM', icon: Settings, color: 'text-sky-400' };
      default:
        return { title: 'PANEL TÁCTICO', icon: Zap, color: 'text-cyan-400' };
    }
  };

  const { title, icon: Icon, color } = getViewMeta();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 pointer-events-auto">
      <div className="relative w-full max-w-5xl h-[88vh] flex flex-col rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-900/40 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-slate-900 border border-slate-700 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {title}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                KRONOS Agente Supremo // Arquitectura Híbrida OpenGrokBot + Rakazo + Hermes-Agent
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic View Body */}
        <div className="flex-1 overflow-hidden p-6">
          {currentView === 'hermes_agent' && (
            <HermesAgentView 
              onRunMission={(mission) => onActionTrigger(`Hermes ejecutando misión: ${mission}`)} 
            />
          )}

          {currentView === 'rakazo_memory' && (
            <RakazoMemoryView />
          )}

          {currentView === 'opengrok_team' && (
            <OpenGrokTeamView />
          )}

          {currentView === 'herramientas' && (
            <div className="space-y-4 font-mono text-xs text-slate-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" /> Pipeline img2threejs
                  </span>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    Extrae mallas 3D de alta fidelidad desde las ilustraciones 2D conceptuales que subiste (vistas frontal, lateral, accesorios de pulso y expresiones).
                  </p>
                  <button 
                    onClick={() => onActionTrigger('Pipeline de img2threejs validado con éxito')}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/30 text-xs"
                  >
                    Simular Extracción 3D
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-fuchsia-500/40 space-y-2">
                  <span className="text-xs font-bold text-fuchsia-300 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-fuchsia-400" /> Empaquetado Electron
                  </span>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    Configuración de ventana transparente con frame rate desacoplado, GPU WebGL acelerado y conexión nativa con Ollama local.
                  </p>
                  <button 
                    onClick={() => onActionTrigger('Boilerplate de Electron compilado y listo')}
                    className="px-3 py-1.5 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/50 text-fuchsia-300 hover:bg-fuchsia-500/30 text-xs"
                  >
                    Auditar Bundle
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentView === 'configuracion' && (
            <div className="space-y-4 font-mono text-xs text-slate-300">
              <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-3">
                <span className="text-xs font-bold text-cyan-300 block">
                  PARÁMETROS DEL MOTOR HÍBRIDO (TRINITY CONFIG)
                </span>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Motor de Inferencia Predeterminado:</label>
                    <select className="w-full p-2 rounded bg-slate-900 border border-slate-700 text-slate-200">
                      <option>Ollama Local (llama-3.1-8b) - 3.2ms</option>
                      <option>Google Gemini 2.0 Flash - 12ms</option>
                      <option>Llama.cpp Server - 2.8ms</option>
                      <option>Mistral Large 2 - 15ms</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Sensibilidad de Fonemas y Visor:</label>
                    <input type="range" min="1" max="10" defaultValue="9" className="w-full accent-cyan-400" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-cyan-900/40 bg-slate-950/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors text-xs"
          >
            Cerrar Panel
          </button>
        </div>
      </div>
    </div>
  );
};
