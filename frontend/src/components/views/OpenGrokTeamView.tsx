import React, { useState } from 'react';
import { 
  Users, 
  MessageSquare, 
  Send, 
  Bot, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  Radio, 
  Activity, 
  Flame 
} from 'lucide-react';
import { AgentTeammate } from '../../types/jarvis';

export const OpenGrokTeamView: React.FC = () => {
  const [chatInput, setChatInput] = useState('');

  const teammates: AgentTeammate[] = [
    {
      id: 'jarvis',
      name: 'JARVIS Core',
      role: 'Agente Supremo & Orquestador',
      sourceRepo: 'OpenGrokBot',
      status: 'Activo',
      avatarColor: 'border-cyan-400 text-cyan-300 bg-cyan-950/60',
      description: 'Líder del equipo. Asigna tareas, modula cinemática y sintetiza voz para Facu.',
      currentTask: 'Supervisando enlace de red y fabric de 5 nodos',
    },
    {
      id: 'hermes',
      name: 'Hermes Coder',
      role: 'Ejecutor Autónomo de Herramientas',
      sourceRepo: 'Hermes-Agent',
      status: 'Activo',
      avatarColor: 'border-fuchsia-500 text-fuchsia-300 bg-fuchsia-950/60',
      description: 'Especialista en loops de razonamiento <think>, auto-corrección de código y terminal.',
      currentTask: 'Compilando arquitectura en Electron + Vite',
    },
    {
      id: 'grok',
      name: 'Grok Scout',
      role: 'Investigador & Telemetría en Tiempo Real',
      sourceRepo: 'OpenGrokBot',
      status: 'Activo',
      avatarColor: 'border-amber-400 text-amber-300 bg-amber-950/60',
      description: 'Monitoreo de red, crawling de documentación de repositorios y benchmarking.',
      currentTask: 'Optimizando latencia de inferencia a 3.4ms',
    },
    {
      id: 'rakazo',
      name: 'Rakazo Automator',
      role: 'Memoria Persistente & Workflows',
      sourceRepo: 'Rakazo',
      status: 'Activo',
      avatarColor: 'border-emerald-400 text-emerald-300 bg-emerald-950/60',
      description: 'Almacenamiento vectorial de preferencias de Facu, cron jobs y aislamiento sandbox.',
      currentTask: 'Manteniendo 100% de coherencia en vector store',
    },
  ];

  const [messages, setMessages] = useState<Array<{ sender: string; text: string; time: string; color: string }>>([
    {
      sender: 'JARVIS Core',
      text: 'Equipo, Facu requiere una arquitectura propia: ultra liviana, rápida, con avatar expresivo y sin dependencias pesadas.',
      time: '23:18:10',
      color: 'text-cyan-300',
    },
    {
      sender: 'Hermes Coder',
      text: 'Entendido. Eliminé los polígonos genéricos y activé el escenario de alta resolución con cinemática reactiva. Las herramientas bash corren en sub-10ms.',
      time: '23:18:14',
      color: 'text-fuchsia-300',
    },
    {
      sender: 'Grok Scout',
      text: 'Métricas óptimas: 0 errores de compilación, 5 tests pasando, 142 tokens/s en el motor local.',
      time: '23:18:19',
      color: 'text-amber-300',
    },
    {
      sender: 'Rakazo Automator',
      text: 'Preferencia de Facu registrada en memoria persistente: excelencia visual, cinemática ágil y control por voz.',
      time: '23:18:24',
      color: 'text-emerald-300',
    },
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = {
      sender: 'Facu',
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString(),
      color: 'text-slate-100 font-bold',
    };

    const jarvisReply = {
      sender: 'JARVIS Core',
      text: `Orden recibida: "${chatInput.trim()}". Coordinando con Hermes y Grok para ejecutar con máxima prioridad.`,
      time: new Date().toLocaleTimeString(),
      color: 'text-cyan-300',
    };

    setMessages((prev) => [...prev, userMsg, jarvisReply]);
    setChatInput('');
  };

  return (
    <div className="flex flex-col h-full space-y-4 font-mono text-xs">
      {/* Top Banner explaining OpenGrokBot Architecture */}
      <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-400/40 text-amber-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100">
                OPENGROKBOT MULTI-AGENT COLLABORATIVE WORKSPACE
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px]">
                SQUAD: 4 AGENTES
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Inspirado en <strong>Z4YT0N/OpenGrokBot</strong>: múltiples agentes autónomos con personalidades y especialidades que colaboran entre sí y contigo en un canal unificado.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-slate-400 text-[11px]">
          <span>Concurrencia: <strong className="text-emerald-400">Paralelo</strong></span>
          <span>Latencia Mesh: <strong className="text-cyan-400">3.4ms</strong></span>
        </div>
      </div>

      {/* Grid of the 4 Teammates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {teammates.map((mate) => (
          <div
            key={mate.id}
            className="p-3 rounded-xl bg-slate-950/85 border border-slate-800 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${mate.avatarColor}`}>
                  {mate.name}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {mate.status}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                {mate.role}
              </span>
              <p className="text-[11px] text-slate-400 font-sans leading-tight line-clamp-2">
                {mate.description}
              </p>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] text-cyan-300 truncate">
              &gt; {mate.currentTask}
            </div>
          </div>
        ))}
      </div>

      {/* Shared Team Chat Stream */}
      <div className="flex-1 overflow-y-auto space-y-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
        {messages.map((msg, i) => (
          <div key={i} className="flex items-start gap-2.5 text-xs font-mono">
            <span className="text-slate-600 shrink-0 text-[10px] pt-0.5">[{msg.time}]</span>
            <div className="flex-1">
              <span className={`font-bold mr-2 ${msg.color}`}>{msg.sender}:</span>
              <span className="text-slate-300 font-sans">{msg.text}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Envía una instrucción al squad de agentes (JARVIS, Hermes, Grok, Rakazo)..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/90 border border-amber-500/40 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 text-xs"
        />
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors flex items-center gap-2 shrink-0"
        >
          <Send className="w-4 h-4" />
          <span>Enviar a la Sala</span>
        </button>
      </form>
    </div>
  );
};
