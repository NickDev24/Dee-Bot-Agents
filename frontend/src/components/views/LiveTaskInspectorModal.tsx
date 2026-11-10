import React from 'react';
import { 
  X, 
  Globe, 
  Terminal, 
  Code2, 
  Database, 
  MessageSquareCode, 
  FolderGit2, 
  Cpu, 
  Activity, 
  CheckCircle2, 
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Send,
  Sliders
} from 'lucide-react';
import { NeuralTaskNode } from '../../types/jarvis';

interface LiveTaskInspectorModalProps {
  task: NeuralTaskNode;
  onClose: () => void;
  onSpeakStatus?: (msg: string) => void;
}

export const LiveTaskInspectorModal: React.FC<LiveTaskInspectorModalProps> = ({
  task,
  onClose,
  onSpeakStatus,
}) => {
  const getCategoryIcon = () => {
    switch (task.category) {
      case 'browser': return Globe;
      case 'terminal': return Terminal;
      case 'editor': return Code2;
      case 'database': return Database;
      case 'communication': return MessageSquareCode;
      case 'files': return FolderGit2;
      default: return Activity;
    }
  };

  const Icon = getCategoryIcon();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-none pointer-events-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-slate-900 border border-cyan-500/50 shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden"
        style={{ borderColor: `${task.color}88` }}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl border flex items-center justify-center text-lg"
              style={{ backgroundColor: `${task.color}15`, borderColor: `${task.color}60`, color: task.color }}
            >
              <span>{task.icon}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100 font-mono">
                  {task.name}
                </h3>
                <span 
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border"
                  style={{ backgroundColor: `${task.color}20`, borderColor: `${task.color}70`, color: task.color }}
                >
                  {task.badge}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {task.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">
                {task.details}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSpeakStatus?.(`Reporte de ${task.name}: Operando al 100% de capacidad con ${task.metrics.cpu} de consumo.`)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] transition-colors"
              title="Escuchar reporte"
            >
              🎙️ Reportar
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Real-time Telemetry Strip */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-950 border-b border-slate-800 font-mono text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>CPU: {task.metrics.cpu}</span>
            </span>
            <span className="flex items-center gap-1.5 text-fuchsia-300">
              <Activity className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>RAM: {task.metrics.ram}</span>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-300">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Throughput: {task.metrics.throughput}</span>
            </span>
          </div>

          <span className="text-slate-500 hidden sm:inline">
            HILO NEURONAL 3D ACTIVO · PRIORIDAD 1
          </span>
        </div>

        {/* Body Content based on Category */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-xs text-slate-200">
          {/* Subtasks Progress List */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 tracking-wider block mb-2">
              PIPELINE DE TAREAS EN EJECUCIÓN (HERMES + OPENGROK)
            </span>
            <div className="space-y-1.5">
              {task.subtasks.map((st, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-300 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{st}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 1. BROWSER VIEW (Live Scraped Feed & Simulated Web View) */}
          {task.category === 'browser' && (
            <div className="rounded-xl border border-cyan-500/40 bg-slate-950 overflow-hidden shadow-lg">
              {/* Browser bar */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 text-[11px]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <div className="flex-1 ml-2 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-300 text-[10px] flex items-center justify-between">
                  <span className="truncate">{task.previewUrl}</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>

              {/* Live Web Content Feed */}
              <div className="p-4 space-y-3 font-sans">
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-cyan-300">@SaaS_Founder_Dev</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">MATCH: 98%</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    "Buscamos desarrollador senior para crear un agente de escritorio en Electron + Three.js con LLMs locales. Presupuesto $4k-6k USD."
                  </p>
                  <div className="mt-2 flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] font-mono border border-cyan-800">
                      Auto-Contactado
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                      Lead ID: #8841
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-fuchsia-300">@AI_AutomationStudio</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">MATCH: 94%</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    "¿Alguien tiene un bot autónomo con memoria persistente que no consuma 32GB de RAM? Pago por licencia o integración custom."
                  </p>
                  <div className="mt-2 flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-fuchsia-950 text-fuchsia-300 text-[10px] font-mono border border-fuchsia-800">
                      Enviando Portfolio
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. TERMINAL VIEW (Live Streaming Shell Output) */}
          {task.category === 'terminal' && task.codeSnippet && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] leading-relaxed text-cyan-300 overflow-x-auto">
              <pre>{task.codeSnippet}</pre>
            </div>
          )}

          {/* 3. EDITOR VIEW (AST Code Diff) */}
          {task.category === 'editor' && task.codeSnippet && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] leading-relaxed text-emerald-300 overflow-x-auto">
              <pre>{task.codeSnippet}</pre>
            </div>
          )}

          {/* 4. COMMUNICATION VIEW (Live Client Chat Thread) */}
          {task.category === 'communication' && task.chatSnippet && (
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 font-sans space-y-3">
              <span className="text-[10px] font-mono font-bold text-amber-400 tracking-wider block">
                CONVERSACIÓN ACTIVA CON CLIENTE POTENCIAL (NEGOCIACIÓN EN VIVO)
              </span>
              <div className="space-y-2">
                {task.chatSnippet.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`p-3 rounded-xl max-w-[85%] text-xs ${
                      msg.sender.includes('Dee') || msg.sender.includes('Kronos')
                        ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-100 ml-auto' 
                        : 'bg-slate-900 border border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 mb-1">
                      <span className="font-bold text-slate-300">{msg.sender}</span>
                      <span>{msg.time}</span>
                    </div>
                    <p className="leading-snug">{msg.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. DATABASE VIEW (Vector Metrics) */}
          {task.category === 'database' && (
            <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40">
                <span className="text-slate-400 block mb-1">Total Vectores Indexados:</span>
                <span className="text-lg font-bold text-emerald-400">1,420,512</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/40">
                <span className="text-slate-400 block mb-1">Latencia Búsqueda Coseno:</span>
                <span className="text-lg font-bold text-cyan-400">2.1 ms (Ollama HNSW)</span>
              </div>
            </div>
          )}

          {/* 6. FILES VIEW */}
          {task.category === 'files' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/40 font-mono text-[11px] text-slate-300 space-y-1.5">
              <p className="text-rose-400 font-bold">ESTRUCTURA DE PROYECTO LIMPIA Y REORGANIZADA:</p>
              <p className="text-slate-400">├── /dist/electron/main.js (34.2 MB) ✓</p>
              <p className="text-slate-400">├── /src/three/CyberBird3D.ts (Malla 3D compacta) ✓</p>
              <p className="text-slate-400">├── /database/vectors.db (1.4M vectores sincronizados) ✓</p>
              <p className="text-emerald-400">└── 0 archivos huérfanos · 100% verificado</p>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950 font-mono text-xs">
          <span className="text-slate-400 text-[11px]">
            Computadora de laboratorio sincronizada con Dee Agent v3.0
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onSpeakStatus?.(`Pausando temporalmente el nodo ${task.name}`);
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors text-[11px]"
            >
              Pausar Nodo
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors text-[11px]"
            >
              Cerrar Vista
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
