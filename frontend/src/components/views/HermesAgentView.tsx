import React, { useState } from 'react';
import { 
  Terminal, 
  Play, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  Brain, 
  Workflow, 
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { HermesThoughtStep } from '../../types/jarvis';

interface HermesAgentViewProps {
  onRunMission: (mission: string) => void;
}

export const HermesAgentView: React.FC<HermesAgentViewProps> = ({ onRunMission }) => {
  const [missionInput, setMissionInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [thoughtSteps, setThoughtSteps] = useState<HermesThoughtStep[]>([
    {
      id: 'step-1',
      timestamp: '23:14:02',
      agent: 'Hermes-Agent // Planner',
      type: 'think',
      content: 'Objetivo recibido de Facu: Construir un híbrido ultra-liviano entre OpenGrokBot (multi-agentes), Rakazo (memoria y BYOM) y Hermes-Agent (loop autónomo y llamadas a herramientas).',
      durationMs: 12,
    },
    {
      id: 'step-2',
      timestamp: '23:14:03',
      agent: 'Hermes-Agent // Tools',
      type: 'tool_call',
      content: 'Invocando terminal sandboxed para verificar puertos, memoria RAM y socket de Electron.',
      toolName: 'bash_sandbox_exec',
      toolArgs: { cmd: 'electron --version && ollama list && mem_check --free' },
      durationMs: 8,
    },
    {
      id: 'step-3',
      timestamp: '23:14:03',
      agent: 'Hermes-Agent // Sandbox',
      type: 'tool_result',
      content: 'v32.1.0 | Modelos activos: llama-3.1-8b (Q4_K_M), mistral-nemo | RAM libre: 14.8 GB | GPU VRAM: 98% disponible.',
      durationMs: 14,
    },
    {
      id: 'step-4',
      timestamp: '23:14:04',
      agent: 'Hermes-Agent // Reflection',
      type: 'reflection',
      content: 'Loop verificado: la latencia de respuesta se sitúa en 3.4ms usando el runtime local de Ollama + WebGL frontend, superando a las alternativas pesadas de Python. Se procede a coordinar con el squad de OpenGrokBot.',
      durationMs: 6,
    },
    {
      id: 'step-5',
      timestamp: '23:14:05',
      agent: 'JARVIS Core',
      type: 'answer',
      content: 'Todo listo Facu. El agente autónomo tiene capacidades de ejecución directa de herramientas, auto-corrección de código y renderizado de alta fidelidad.',
    },
  ]);

  const handleStartMission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!missionInput.trim()) return;

    setIsRunning(true);
    const newStep: HermesThoughtStep = {
      id: `step-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      agent: 'Hermes-Agent // Autonomous Execution',
      type: 'think',
      content: `Ejecutando misión de Facu: "${missionInput.trim()}". Desplegando sub-agentes en paralelo.`,
      durationMs: 15,
    };

    setThoughtSteps((prev) => [newStep, ...prev]);
    onRunMission(missionInput.trim());
    setMissionInput('');

    setTimeout(() => {
      const toolStep: HermesThoughtStep = {
        id: `step-${Date.now() + 1}`,
        timestamp: new Date().toLocaleTimeString(),
        agent: 'Hermes-Agent // Tool Exec',
        type: 'tool_call',
        content: 'Ejecutando tool call: `analyze_codebase_and_sync_memory()`',
        toolName: 'vector_search_and_exec',
        toolArgs: { query: missionInput, sandbox: 'isolated_container' },
        durationMs: 9,
      };
      setThoughtSteps((prev) => [toolStep, ...prev]);
      setIsRunning(false);
    }, 900);
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full space-y-4 font-mono text-xs">
      {/* Top Banner explaining Hermes Agent Integration */}
      <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-400/40 text-cyan-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100">
                NOUS RESEARCH HERMES-AGENT // AUTONOMOUS REASONING LOOP
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px]">
                LOOP: ACTIVO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Patrón de razonamiento autónomo con etiquetas <code>&lt;think&gt;</code>, auto-reflexión, ejecución de herramientas en sandbox y auto-aprendizaje continuo.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-slate-400 text-[11px]">
          <span>Latencia de Pensamiento: <strong className="text-cyan-400">12ms</strong></span>
          <span>Herramientas Disponibles: <strong className="text-emerald-400">14</strong></span>
        </div>
      </div>

      {/* Input bar to launch autonomous mission */}
      <form onSubmit={handleStartMission} className="flex gap-2">
        <div className="relative flex-1">
          <Terminal className="absolute left-3.5 top-3 w-4 h-4 text-cyan-400" />
          <input
            type="text"
            value={missionInput}
            onChange={(e) => setMissionInput(e.target.value)}
            placeholder="Escribe una misión compleja para Hermes-Agent (ej: 'Compilar pipeline de img2threejs y auditar memoria')..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/90 border border-cyan-500/40 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
          />
        </div>
        <button
          type="submit"
          disabled={isRunning}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50"
        >
          {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          <span>Ejecutar Misión</span>
        </button>
      </form>

      {/* Reasoning Trace Stream */}
      <div className="flex-1 overflow-y-auto space-y-3 p-1">
        {thoughtSteps.map((step) => {
          const isThink = step.type === 'think';
          const isToolCall = step.type === 'tool_call';
          const isToolResult = step.type === 'tool_result';
          const isReflection = step.type === 'reflection';
          const isAnswer = step.type === 'answer';

          return (
            <div
              key={step.id}
              className={`p-3.5 rounded-xl border transition-all ${
                isThink ? 'bg-slate-950/90 border-cyan-500/30' :
                isToolCall ? 'bg-fuchsia-950/30 border-fuchsia-500/40' :
                isToolResult ? 'bg-emerald-950/25 border-emerald-500/35' :
                isReflection ? 'bg-amber-950/25 border-amber-500/35' :
                'bg-cyan-950/30 border-cyan-400/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isThink ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' :
                    isToolCall ? 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30' :
                    isToolResult ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                    isReflection ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                    'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  }`}>
                    {step.type.toUpperCase()}
                  </span>
                  <span className="text-slate-300 font-semibold">{step.agent}</span>
                </div>

                <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                  <Clock className="w-3 h-3" />
                  <span>{step.timestamp}</span>
                  {step.durationMs && (
                    <span className="text-cyan-400">({step.durationMs}ms)</span>
                  )}
                  <button
                    onClick={() => copyText(step.content, step.id)}
                    className="p-1 hover:text-slate-300"
                    title="Copiar traza"
                  >
                    {copiedId === step.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <p className="text-slate-200 leading-relaxed font-sans text-xs">
                {step.content}
              </p>

              {step.toolName && (
                <div className="mt-2 p-2 rounded-lg bg-black/70 border border-slate-800 text-[11px] text-emerald-400">
                  <span className="text-slate-500 block mb-0.5 font-bold">TOOL INVOCATION:</span>
                  <code>{step.toolName}({JSON.stringify(step.toolArgs || {})})</code>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
