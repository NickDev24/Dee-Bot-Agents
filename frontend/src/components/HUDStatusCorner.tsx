import React from 'react';
import { CheckCircle2, ShieldCheck, Terminal } from 'lucide-react';

interface HUDStatusCornerProps {
  statusMessage?: string;
  activeAgentsCount?: number;
  availableModelsCount?: number;
}

export const HUDStatusCorner: React.FC<HUDStatusCornerProps> = ({
  statusMessage = 'JARVIS listo para recibir órdenes.',
  activeAgentsCount = 3,
  availableModelsCount = 6,
}) => {
  return (
    <div className="relative z-20 w-80 p-3.5 rounded-xl bg-slate-950/98 border border-cyan-500/40 shadow-[0_0_30px_rgba(0,0,0,0.9)] pointer-events-auto">
      <div className="flex items-center justify-between border-b border-cyan-900/40 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-wider text-cyan-300">
            DIAGNÓSTICO DEL SISTEMA
          </span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          NORMAL
        </span>
      </div>

      <div className="space-y-1.5 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">
            <strong className="text-emerald-400 font-semibold">Sistema:</strong> {statusMessage}
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-emerald-400 font-semibold">Conexión con el fabric:</strong> OK
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-emerald-400 font-semibold">Modelos disponibles:</strong> {availableModelsCount}
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-emerald-400 font-semibold">Agentes activos:</strong> {activeAgentsCount}
          </span>
        </div>
      </div>

      {/* Decorative neon corner accent */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span className="flex items-center gap-1">
          <Terminal className="w-3 h-3 text-cyan-400" /> Latencia Fabric: 3.4ms
        </span>
        <div className="flex gap-1">
          <div className="w-2.5 h-1 bg-cyan-400 rounded-sm" />
          <div className="w-2.5 h-1 bg-fuchsia-500 rounded-sm" />
          <div className="w-2.5 h-1 bg-emerald-400 rounded-sm" />
        </div>
      </div>
    </div>
  );
};
