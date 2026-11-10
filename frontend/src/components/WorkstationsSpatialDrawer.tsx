import React from 'react';
import { X, Sliders, Monitor, ExternalLink, Cpu, HardDrive } from 'lucide-react';
import { NEURAL_TASKS } from '../data/neuralTasks';
import { NeuralTaskNode } from '../types/jarvis';

interface WorkstationsSpatialDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  nodeScale: number;
  setNodeScale: React.Dispatch<React.SetStateAction<number>>;
  orbitRadius: number;
  setOrbitRadius: React.Dispatch<React.SetStateAction<number>>;
  orbitAngle: number;
  setOrbitAngle: React.Dispatch<React.SetStateAction<number>>;
  orbitPaused: boolean;
  setOrbitPaused: React.Dispatch<React.SetStateAction<number | boolean | any>>;
  onSelectTask: (taskId: string) => void;
}

export const WorkstationsSpatialDrawer: React.FC<WorkstationsSpatialDrawerProps> = ({
  isOpen,
  onClose,
  nodeScale,
  setNodeScale,
  orbitRadius,
  setOrbitRadius,
  orbitAngle,
  setOrbitAngle,
  orbitPaused,
  setOrbitPaused,
  onSelectTask,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm pointer-events-auto animate-in fade-in">
      <div 
        className="w-full max-w-md h-full bg-slate-950/95 border-l border-cyan-500/30 p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-400/60 flex items-center justify-center text-cyan-300">
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-mono font-bold text-slate-100 tracking-wider">
                  ESCRITORIO 3D // WORKSTATIONS
                </h2>
                <p className="text-[10px] text-slate-400 font-mono">
                  6 Computadoras conectadas a Dee en tiempo real
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-400 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 3D Hardware Controls */}
          <div className="mt-5 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-3 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                CALIBRACIÓN DEL LABORATORIO 3D
              </span>
              <button
                onClick={() => {
                  setNodeScale(1.0);
                  setOrbitRadius(2.4);
                  setOrbitAngle(0);
                  setOrbitPaused(false);
                }}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 transition-colors"
              >
                Reset
              </button>
            </div>

            {/* Scale */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Tamaño computadoras:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setNodeScale((prev) => Math.max(0.6, Number((prev - 0.15).toFixed(2))))}
                  className="w-6 h-6 rounded bg-slate-800 border border-slate-700 hover:border-cyan-400 flex items-center justify-center text-slate-200"
                >
                  -
                </button>
                <span className="w-12 text-center font-bold text-cyan-300 text-xs">
                  {(nodeScale * 100).toFixed(0)}%
                </span>
                <button
                  onClick={() => setNodeScale((prev) => Math.min(2.0, Number((prev + 0.15).toFixed(2))))}
                  className="w-6 h-6 rounded bg-slate-800 border border-slate-700 hover:border-cyan-400 flex items-center justify-center text-slate-200"
                >
                  +
                </button>
              </div>
            </div>

            {/* Spread */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Separación en escritorio:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setOrbitRadius((prev) => Math.max(1.7, Number((prev - 0.2).toFixed(2))))}
                  className="w-6 h-6 rounded bg-slate-800 border border-slate-700 hover:border-cyan-400 flex items-center justify-center text-slate-200"
                >
                  -
                </button>
                <span className="w-12 text-center font-bold text-cyan-300 text-xs">
                  {orbitRadius.toFixed(1)}m
                </span>
                <button
                  onClick={() => setOrbitRadius((prev) => Math.min(3.8, Number((prev + 0.2).toFixed(2))))}
                  className="w-6 h-6 rounded bg-slate-800 border border-slate-700 hover:border-cyan-400 flex items-center justify-center text-slate-200"
                >
                  +
                </button>
              </div>
            </div>

            {/* Orbit Pan & Pause */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Giro de cámara 3D:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setOrbitAngle((prev) => prev - 0.35)}
                  className="px-2 h-6 rounded bg-slate-800 border border-slate-700 hover:border-cyan-400 text-slate-200"
                >
                  ◀
                </button>
                <button
                  onClick={() => setOrbitPaused((prev: boolean) => !prev)}
                  className={`px-2 h-6 rounded border text-[10px] font-bold ${
                    orbitPaused ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {orbitPaused ? '▶ Play' : '⏸ Pausa'}
                </button>
                <button
                  onClick={() => setOrbitAngle((prev) => prev + 0.35)}
                  className="px-2 h-6 rounded bg-slate-800 border border-slate-700 hover:border-cyan-400 text-slate-200"
                >
                  ▶
                </button>
              </div>
            </div>
          </div>

          {/* Connected Workstations List */}
          <div className="mt-6">
            <h3 className="text-xs font-mono font-bold text-slate-300 tracking-wider mb-3">
              COMPUTADORAS DEL LABORATORIO (HAZ CLIC PARA ABRIR):
            </h3>
            <div className="flex flex-col gap-2.5">
              {NEURAL_TASKS.map((task) => (
                <div
                  key={task.id}
                  onClick={() => {
                    onSelectTask(task.id);
                    onClose();
                  }}
                  className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-400/70 transition-all cursor-pointer flex items-center justify-between group shadow-sm"
                  style={{
                    borderLeftWidth: '4px',
                    borderLeftColor: task.color,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{task.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors font-mono">
                          {task.name}
                        </span>
                        <span 
                          className="text-[9px] font-mono px-1.5 py-0.2 rounded-full border"
                          style={{
                            color: task.color,
                            borderColor: `${task.color}50`,
                            backgroundColor: `${task.color}15`,
                          }}
                        >
                          {task.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {task.details}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
          <span>DEE AGENT V3.0</span>
          <span className="text-emerald-400">● 6 COMPUTADORAS ACTIVAS</span>
        </div>
      </div>
    </div>
  );
};
