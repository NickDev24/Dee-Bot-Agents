import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal as TerminalIcon,
  Minimize2,
  Maximize2,
  X,
  Play,
  Trash2,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  GripHorizontal,
  Sparkles,
} from 'lucide-react';

export interface TerminalLogEntry {
  id: string;
  ts: string;
  target: string;
  cmd: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
  status: 'running' | 'ok' | 'error' | 'agent';
  agentName?: string;
}

interface DraggableLiveTerminalProps {
  isOpen: boolean;
  isMinimized: boolean;
  onClose: () => void;
  onToggleMinimize: () => void;
  entries: TerminalLogEntry[];
  onClear: () => void;
  onExecuteCommand: (cmd: string, targetNode: string) => Promise<void>;
  activeTaskLabel?: string;
}

export const DraggableLiveTerminal: React.FC<DraggableLiveTerminalProps> = ({
  isOpen,
  isMinimized,
  onClose,
  onToggleMinimize,
  entries,
  onClear,
  onExecuteCommand,
  activeTaskLabel,
}) => {
  // Position state so user can freely drag the terminal anywhere on screen
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(20, typeof window !== 'undefined' ? window.innerWidth - 560 : 40),
    y: 78,
  }));
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cmdInput, setCmdInput] = useState('');
  const [targetNode, setTargetNode] = useState<'facu' | 'barto' | 'manager1'>('facu');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const outputEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to newest terminal output
  useEffect(() => {
    if (isOpen && !isMinimized) {
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, isOpen, isMinimized]);

  // Keep inside viewport on window resize
  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => ({
        x: Math.max(12, Math.min(prev.x, window.innerWidth - 360)),
        y: Math.max(56, Math.min(prev.y, window.innerHeight - 120)),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Pointer drag handlers
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const nextX = Math.max(8, Math.min(window.innerWidth - 320, e.clientX - dragOffsetRef.current.dx));
      const nextY = Math.max(8, Math.min(window.innerHeight - 80, e.clientY - dragOffsetRef.current.dy));
      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    e.stopPropagation();
    dragOffsetRef.current = {
      dx: e.clientX - position.x,
      dy: e.clientY - position.y,
    };
    setIsDragging(true);
  };

  const handleRunCommand = async (e?: React.FormEvent, overrideCmd?: string) => {
    if (e) e.preventDefault();
    const finalCmd = (overrideCmd ?? cmdInput).trim();
    if (!finalCmd || isSubmitting) return;
    if (!overrideCmd) setCmdInput('');
    setIsSubmitting(true);
    try {
      await onExecuteCommand(finalCmd, targetNode);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  };

  if (!isOpen) return null;

  // Minimized Floating Pill
  if (isMinimized) {
    return (
      <div
        style={{ left: position.x, top: position.y }}
        onPointerDown={handleHeaderPointerDown}
        className="fixed z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#070b14]/95 border border-cyan-500/50 backdrop-blur-2xl shadow-[0_0_30px_rgba(0,240,255,0.22)] cursor-grab active:cursor-grabbing select-none pointer-events-auto"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <TerminalIcon className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-mono font-bold text-slate-100">
          TERMINAL EN VIVO DEE ({entries.length})
        </span>
        <button
          onClick={onToggleMinimize}
          className="px-2 py-0.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[11px] font-mono transition-colors"
        >
          Desplegar
        </button>
      </div>
    );
  }

  const widthClass = isExpanded ? 'w-[700px] max-w-[94vw]' : 'w-[520px] max-w-[92vw]';
  const heightClass = isExpanded ? 'h-[480px] max-h-[78vh]' : 'h-[340px] max-h-[65vh]';

  return (
    <div
      style={{ left: position.x, top: position.y }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`fixed z-40 ${widthClass} rounded-2xl bg-[#050811]/92 border border-slate-700/80 hover:border-cyan-500/60 backdrop-blur-2xl shadow-[0_20px_70px_rgba(0,0,0,0.85),0_0_35px_rgba(0,240,255,0.14)] flex flex-col overflow-hidden transition-shadow pointer-events-auto`}
    >
      {/* 1. BARRA SUPERIOR ARRASTRABLE EN ESPAÑOL */}
      <div
        onPointerDown={handleHeaderPointerDown}
        className={`flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-slate-900/95 via-[#091224]/95 to-slate-900/95 border-b border-slate-800/90 select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400/80" />
          </div>
          <GripHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold tracking-wider text-cyan-300">
                TERMINAL EN VIVO DE DEE // CONSOLA REAL
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-[9px] font-mono text-emerald-300">
                CONECTADA :8091 · :8731
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 truncate">
              {activeTaskLabel || 'Arrastrá esta ventana libremente · Conectada en tiempo real'}
            </p>
          </div>
        </div>

        {/* Controles de Ventana */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Selector de Nodo Físico */}
          <select
            value={targetNode}
            onChange={(e) => setTargetNode(e.target.value as 'facu' | 'barto' | 'manager1')}
            className="bg-slate-950/90 border border-slate-700/80 rounded-lg px-2 py-1 text-[10px] font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
            title="Seleccionar nodo físico de ejecución"
          >
            <option value="facu">⚡ facu (Maestro)</option>
            <option value="barto">🛠️ barto (Nodo 1)</option>
            <option value="manager1">🌐 manager1 (Nodo 2)</option>
          </select>

          <button
            onClick={onClear}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Limpiar salida de terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
            title={isExpanded ? 'Tamaño compacto' : 'Ampliar ventana'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleMinimize}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
            title="Minimizar terminal a píldora flotante"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 transition-colors"
            title="Ocultar terminal (se abrirá automáticamente al ejecutar cualquier tarea)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. BARRA DE EJECUCIÓN RÁPIDA EN ESPAÑOL */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/80 border-b border-slate-800/70 overflow-x-auto no-scrollbar">
        <span className="text-[10px] font-mono text-slate-500 shrink-0">Rápido:</span>
        {[
          { label: 'Memoria & Disco', cmd: 'uptime && free -h && df -h / | tail -n 1' },
          { label: 'Top Procesos CPU', cmd: 'ps aux --sort=-%cpu | head -n 7' },
          { label: 'Puertos Activos', cmd: "ss -tln | grep -E ':(3001|8091|8642|8730|8731)'" },
          { label: 'Estado Git', cmd: 'git status -sb && git log --oneline -n 3' },
          { label: 'Imágenes Docker', cmd: 'docker images nickdev24/dee-bot-agents' },
        ].map((q) => (
          <button
            key={q.label}
            onClick={() => handleRunCommand(undefined, q.cmd)}
            className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-cyan-950/70 border border-slate-800 hover:border-cyan-500/40 text-[10px] font-mono text-slate-300 hover:text-cyan-300 transition-colors shrink-0"
          >
            $ {q.label}
          </button>
        ))}
      </div>

      {/* 3. SALIDA EN TIEMPO REAL */}
      <div className={`${heightClass} overflow-y-auto p-3.5 font-mono text-xs space-y-3 bg-[#04070f]/95`}>
        {entries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-8">
            <Cpu className="w-7 h-7 text-cyan-500/50 mb-2 animate-pulse" />
            <p className="text-xs text-slate-300 font-semibold">
              Terminal de Dee lista y conectada a {targetNode.toUpperCase()}
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1">
              Ejecutá cualquier Skill, hablale a Dee o escribí un comando Linux abajo para ver la salida real en vivo.
            </p>
          </div>
        ) : (
          entries.map((item) => (
            <div
              key={item.id}
              className="rounded-xl bg-slate-900/65 border border-slate-800/90 p-2.5 space-y-1.5 shadow-inner"
            >
              {/* Encabezado de Comando */}
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-emerald-400 font-bold shrink-0">
                    facu@{item.target}:~$
                  </span>
                  <span className="text-cyan-200 font-semibold break-all">{item.cmd}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.status === 'running' && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] animate-pulse">
                      EJECUTANDO...
                    </span>
                  )}
                  {item.status === 'ok' && (
                    <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
                      <CheckCircle2 className="w-3 h-3" />
                      {item.durationMs !== undefined ? `${item.durationMs}ms` : 'LISTO'}
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="flex items-center gap-1 text-rose-400 text-[10px]">
                      <AlertTriangle className="w-3 h-3" />
                      CÓD. {item.exitCode ?? 1}
                    </span>
                  )}
                  {item.status === 'agent' && (
                    <span className="flex items-center gap-1 text-purple-300 text-[10px]">
                      <Sparkles className="w-3 h-3" />
                      {item.agentName || 'Dee Prime'}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">{item.ts}</span>
                </div>
              </div>

              {/* SALIDA ESTÁNDAR */}
              {item.stdout && (
                <pre className="text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap break-words bg-slate-950/80 p-2 rounded-lg border border-slate-800/60 overflow-x-auto">
                  {item.stdout}
                </pre>
              )}

              {/* SALIDA DE ERROR */}
              {item.stderr && (
                <pre className="text-[11px] leading-relaxed text-rose-300 whitespace-pre-wrap break-words bg-rose-950/30 p-2 rounded-lg border border-rose-800/40 overflow-x-auto">
                  {item.stderr}
                </pre>
              )}
            </div>
          ))
        )}
        <div ref={outputEndRef} />
      </div>

      {/* 4. ENTRADA INTERACTIVA DE COMANDOS LINUX Y SKILLS */}
      <form
        onSubmit={(e) => handleRunCommand(e)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-950 border-t border-slate-800/90"
      >
        <span className="text-[11px] font-mono font-bold text-emerald-400 shrink-0">
          {targetNode}@dee:~$
        </span>
        <input
          ref={inputRef}
          type="text"
          value={cmdInput}
          onChange={(e) => setCmdInput(e.target.value)}
          placeholder="Comando Linux real (ej: free -h, ls -la) o /skill (ej: /auditar-nodos)..."
          className="flex-1 bg-transparent text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!cmdInput.trim() || isSubmitting}
          className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-slate-950 font-mono font-bold text-[11px] flex items-center gap-1 transition-all"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Ejecutar</span>
        </button>
      </form>
    </div>
  );
};
