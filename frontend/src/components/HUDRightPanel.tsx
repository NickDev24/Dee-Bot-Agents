import React from 'react';
import { 
  Cpu, 
  Check, 
  Server, 
  Layers, 
  FolderKanban, 
  ExternalLink 
} from 'lucide-react';
import { AIProvider, SystemMetrics } from '../types/jarvis';

interface HUDRightPanelProps {
  metrics: SystemMetrics;
  providers: AIProvider[];
  selectedProviderId: string;
  onSelectProvider: (id: string) => void;
  onOpenProjects: () => void;
}

export const HUDRightPanel: React.FC<HUDRightPanelProps> = ({
  metrics,
  providers,
  selectedProviderId,
  onSelectProvider,
  onOpenProjects,
}) => {
  return (
    <aside className="relative z-20 flex flex-col gap-3.5 w-72 pointer-events-auto">
      {/* 1. ESTADO GENERAL */}
      <div className="p-4 rounded-xl bg-slate-950/95 border border-cyan-500/40 shadow-[0_0_25px_rgba(0,0,0,0.85)]">
        <div className="flex items-center justify-between border-b border-cyan-900/40 pb-2 mb-3">
          <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
            Estado General
          </span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>En línea</span>
          </div>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between text-slate-400">
            <span>Nodos Activos</span>
            <span className="font-semibold text-cyan-300">
              {metrics.nodesActive} / {metrics.totalNodes}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span>Tareas Activas</span>
            <span className="font-semibold text-slate-200">
              {metrics.activeTasks}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span>Memoria</span>
            <span className="font-semibold text-cyan-300">
              {metrics.memoryUsage}%
            </span>
          </div>

          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-cyan-900/40">
            <div 
              className="bg-gradient-to-r from-cyan-400 to-sky-500 h-full rounded-full"
              style={{ width: `${metrics.memoryUsage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-slate-400 pt-1">
            <span>Uptime</span>
            <span className="font-semibold text-slate-200">
              {metrics.uptime}
            </span>
          </div>
        </div>
      </div>

      {/* 2. PROVEEDORES DE IA */}
      <div className="p-4 rounded-xl bg-slate-950/95 border border-cyan-500/40 shadow-[0_0_25px_rgba(0,0,0,0.85)]">
        <div className="flex items-center justify-between border-b border-cyan-900/40 pb-2 mb-3">
          <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
            Proveedores de IA
          </span>
          <span className="text-[10px] font-mono text-cyan-400">
            {providers.length} ROUTED
          </span>
        </div>

        <div className="space-y-1.5">
          {providers.map((p) => {
            const isSelected = selectedProviderId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelectProvider(p.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all text-left ${
                  isSelected
                    ? 'bg-cyan-500/15 border border-cyan-400/50 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                    : 'hover:bg-slate-900/60 text-slate-400 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{p.icon}</span>
                  <span className="font-semibold text-slate-300">{p.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                  <span>Activo</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. PROYECTOS ACTIVOS */}
      <div className="p-4 rounded-xl bg-slate-950/95 border border-cyan-500/40 shadow-[0_0_25px_rgba(0,0,0,0.85)]">
        <div className="flex items-center justify-between border-b border-cyan-900/40 pb-2 mb-2.5">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
              Proyectos Activos
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-400">1</span>
        </div>

        <button
          onClick={onOpenProjects}
          className="w-full mt-1 p-2 rounded-lg bg-slate-900/70 border border-slate-800 hover:border-cyan-500/40 text-left transition-colors group"
        >
          <div className="flex items-center justify-between text-xs text-cyan-300 font-semibold mb-1">
            <span>JARVIS 3D Electron Agent</span>
            <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
          </div>
          <p className="text-[11px] text-slate-400 line-clamp-1">
            Avatar autónomo con rig facial y voz sincronizada.
          </p>
        </button>
      </div>
    </aside>
  );
};
