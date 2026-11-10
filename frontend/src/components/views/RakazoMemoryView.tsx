import React, { useState } from 'react';
import { 
  Database, 
  ShieldCheck, 
  Cpu, 
  Plus, 
  Trash2, 
  Check, 
  Workflow, 
  Sliders, 
  Clock, 
  Layers 
} from 'lucide-react';
import { RakazoMemoryItem } from '../../types/jarvis';

export const RakazoMemoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'memories' | 'byom' | 'sandboxes' | 'routines'>('memories');
  const [newMemory, setNewMemory] = useState({ title: '', content: '', category: 'preferencia' });

  const [memories, setMemories] = useState<RakazoMemoryItem[]>([
    {
      id: 'mem-1',
      category: 'preferencia',
      title: 'Identidad del Usuario: Facu',
      content: 'El usuario principal es Facu. Prefiere respuestas directas, código en TypeScript/Electron, estética cyberpunk de alto impacto y velocidad extrema sin boilerplate innecesario.',
      timestamp: '2026-11-09 23:10',
      confidence: 0.99,
    },
    {
      id: 'mem-2',
      category: 'proyecto',
      title: 'Arquitectura JARVIS Agente Supremo',
      content: 'Híbrido personalizado entre OpenGrokBot (multi-agentes), Rakazo (memoria persistente y BYOM) y Hermes-Agent (loop autónomo y tool calls). El frontend corre en React + Three.js con empaquetado en Electron.',
      timestamp: '2026-11-09 23:12',
      confidence: 0.98,
    },
    {
      id: 'mem-3',
      category: 'conocimiento',
      title: 'Pipeline de conversión con img2threejs',
      content: 'Genera mallas tridimensionales con normales y emisivos a partir de las hojas de diseño V1.1 (gorra con logo 4F, auriculares cyber, hoodie oscuro con seams neón).',
      timestamp: '2026-11-09 23:15',
      confidence: 0.96,
    },
    {
      id: 'mem-4',
      category: 'rutina',
      title: 'Rutina de Salud & Monitoreo de Red',
      content: 'Comprobar cada 5 minutos la latencia de los 5 nodos del fabric, verificar memoria RAM disponible y limpiar sockets inactivos.',
      timestamp: '2026-11-09 23:20',
      confidence: 0.94,
    },
  ]);

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemory.title.trim() || !newMemory.content.trim()) return;

    const item: RakazoMemoryItem = {
      id: `mem-${Date.now()}`,
      category: newMemory.category as any,
      title: newMemory.title.trim(),
      content: newMemory.content.trim(),
      timestamp: new Date().toLocaleString(),
      confidence: 0.95,
    };

    setMemories([item, ...memories]);
    setNewMemory({ title: '', content: '', category: 'preferencia' });
  };

  const handleDeleteMemory = (id: string) => {
    setMemories(memories.filter((m) => m.id !== id));
  };

  return (
    <div className="flex flex-col h-full space-y-4 font-mono text-xs">
      {/* Top Banner explaining Rakazo Architecture */}
      <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-400/40 text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100">
                RAKAZO PERSISTENT MEMORY & AUTONOMOUS ROUTINES
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px]">
                PERSISTENCIA: VECTOR_OK
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Inspirado en <strong>elie222/rakazo</strong>: memoria episódica a largo plazo, rutinas programadas, entornos sandbox y conector multimodelo (BYOM).
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-slate-400 text-[11px]">
          <span>Memorias en Vector Store: <strong className="text-emerald-400">{memories.length}</strong></span>
          <span>Aislamiento Sandbox: <strong className="text-cyan-400">Activo</strong></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-1 bg-slate-950/40 px-2">
        <button
          onClick={() => setActiveTab('memories')}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'memories' ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🧠 Memoria Episódica & Contexto
        </button>
        <button
          onClick={() => setActiveTab('byom')}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'byom' ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🔌 Conectores BYOM (Modelos)
        </button>
        <button
          onClick={() => setActiveTab('sandboxes')}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'sandboxes' ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          📦 Entornos Sandbox & Seguridad
        </button>
      </div>

      {/* Tab 1: Memories */}
      {activeTab === 'memories' && (
        <div className="flex-1 overflow-y-auto space-y-4 p-1">
          {/* Add Memory Form */}
          <form onSubmit={handleAddMemory} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Inyectar Memoria Permanente a JARVIS
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Título del conocimiento..."
                value={newMemory.title}
                onChange={(e) => setNewMemory({ ...newMemory, title: e.target.value })}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs"
              />
              <input
                type="text"
                placeholder="Detalle o instrucción persistente..."
                value={newMemory.content}
                onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:col-span-2"
              />
            </div>
            <div className="flex items-center justify-between">
              <select
                value={newMemory.category}
                onChange={(e) => setNewMemory({ ...newMemory, category: e.target.value })}
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[11px]"
              >
                <option value="preferencia">Preferencia del Usuario</option>
                <option value="proyecto">Proyecto / Arquitectura</option>
                <option value="conocimiento">Base de Conocimiento</option>
                <option value="rutina">Rutina Automatizada</option>
              </select>

              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-xs"
              >
                Guardar Memoria
              </button>
            </div>
          </form>

          {/* List of Persistent Memories */}
          <div className="space-y-2.5">
            {memories.map((m) => (
              <div
                key={m.id}
                className="p-3.5 rounded-xl bg-slate-950/85 border border-slate-800 hover:border-emerald-500/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase">
                      {m.category}
                    </span>
                    <span className="text-xs font-bold text-slate-200">{m.title}</span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                    <span className="text-cyan-400">Score: {(m.confidence * 100).toFixed(0)}%</span>
                    <span>{m.timestamp}</span>
                    <button
                      onClick={() => handleDeleteMemory(m.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  {m.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: BYOM */}
      {activeTab === 'byom' && (
        <div className="space-y-3 p-1">
          <p className="text-xs text-slate-400 font-sans">
            Configuración <strong>Bring Your Own Model</strong> (como en Rakazo). JARVIS conecta nativamente con backends locales de baja latencia o proveedores en la nube:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { name: 'Ollama Local (Recomendado)', model: 'llama-3.1-8b-instruct', ping: '3.2ms', status: 'CONECTADO', type: 'Local (Offline)' },
              { name: 'Llama.cpp Server', model: 'mistral-nemo-12b-q8', ping: '2.8ms', status: 'CONECTADO', type: 'Local (Offline)' },
              { name: 'Google Gemini 2.0 Flash', model: 'gemini-2.0-flash', ping: '12ms', status: 'CONECTADO', type: 'Cloud API' },
              { name: 'Anthropic Claude', model: 'claude-3-5-sonnet', ping: '22ms', status: 'STANDBY', type: 'Cloud API' },
              { name: 'Grok / xAI Engine', model: 'grok-beta-agent', ping: '18ms', status: 'STANDBY', type: 'Cloud API' },
              { name: 'Mistral Large 2', model: 'mistral-large-2407', ping: '15ms', status: 'CONECTADO', type: 'Cloud API' },
            ].map((p, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-200">{p.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {p.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mb-1">Modelo: {p.model}</span>
                  <span className="text-[10px] text-cyan-400 font-bold block">{p.type}</span>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Latencia: <strong className="text-emerald-400">{p.ping}</strong></span>
                  <button className="text-cyan-400 hover:underline">Test Ping</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Sandboxes */}
      {activeTab === 'sandboxes' && (
        <div className="space-y-3 p-1">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-2">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Aislamiento de Entorno Sandboxed (Estilo Rakazo)
            </span>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Toda ejecución de código y terminal realizada por el agente ocurre dentro de entornos aislados con permisos definidos, protegiendo tu sistema host mientras se mantiene la máxima velocidad de ejecución.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
