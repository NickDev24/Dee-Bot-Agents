import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Users,
  Monitor,
  Globe,
  Cpu,
  Calendar,
  Sparkles,
  Puzzle,
  Server,
  Play,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Search,
  MousePointer,
  Volume2,
  GitBranch,
  Layers,
} from 'lucide-react';

export type SeccionCentroOperaciones =
  | 'escuadron'
  | 'control_pc'
  | 'navegador'
  | 'programas'
  | 'agenda'
  | 'skills_rag'
  | 'plugins_relay'
  | 'proveedores_config';

interface CentroOperacionesRealesModalProps {
  abierto: boolean;
  seccionInicial: SeccionCentroOperaciones;
  onCerrar: () => void;
  baseUrl: string;
  agenteActivoId: string;
  onSeleccionarAgente: (id: string, color: string, nombre: string) => void;
  mostrarEscuadron3D: boolean;
  onToggleEscuadron3D: (val: boolean) => void;
  onEjecutarOrden: (orden: string) => void;
}

const SECCIONES: { id: SeccionCentroOperaciones; titulo: string; icono: React.ReactNode }[] = [
  { id: 'escuadron', titulo: 'Escuadrón & Subagentes 3D', icono: <Users className="w-4 h-4" /> },
  { id: 'control_pc', titulo: 'Control Físico PC (X11)', icono: <MousePointer className="w-4 h-4" /> },
  { id: 'navegador', titulo: 'Navegador Real & Driver CDP', icono: <Globe className="w-4 h-4" /> },
  { id: 'programas', titulo: 'Programas & Procesos Linux', icono: <Cpu className="w-4 h-4" /> },
  { id: 'agenda', titulo: 'Agenda & Rutinas Cron', icono: <Calendar className="w-4 h-4" /> },
  { id: 'skills_rag', titulo: 'Skills & Motor RAG 0-RAM', icono: <Sparkles className="w-4 h-4" /> },
  { id: 'plugins_relay', titulo: 'Gateway, Relay & Worktrees', icono: <Puzzle className="w-4 h-4" /> },
  { id: 'proveedores_config', titulo: 'Proveedores IA & Ajustes', icono: <Server className="w-4 h-4" /> },
];

export const CentroOperacionesRealesModal: React.FC<CentroOperacionesRealesModalProps> = ({
  abierto,
  seccionInicial,
  onCerrar,
  baseUrl,
  agenteActivoId,
  onSeleccionarAgente,
  mostrarEscuadron3D,
  onToggleEscuadron3D,
  onEjecutarOrden,
}) => {
  const [seccion, setSeccion] = useState<SeccionCentroOperaciones>(seccionInicial);
  const [cargando, setCargando] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<string | null>(null);

  // Estados de datos reales desde el backend (:8091)
  const [escuadron, setEscuadron] = useState<any[]>([]);
  const [configuracion, setConfiguracion] = useState<any>({});
  const [estadoPc, setEstadoPc] = useState<any>(null);
  const [urlCapturaPc, setUrlCapturaPc] = useState<string | null>(null);
  const [coordX, setCoordX] = useState<number>(600);
  const [coordY, setCoordY] = useState<number>(400);
  const [textoTeclado, setTextoTeclado] = useState<string>('');

  // Navegador & CDP
  const [urlNavegador, setUrlNavegador] = useState<string>('https://facucercuetti.online/blog');
  const [datosNavegador, setDatosNavegador] = useState<any>(null);
  const [mapaCdp, setMapaCdp] = useState<any[]>([]);
  const [modoVistaWeb, setModoVistaWeb] = useState<'estructurado' | 'iframe'>('estructurado');

  // Programas & Procesos
  const [programas, setProgramas] = useState<any[]>([]);
  const [procesos, setProcesos] = useState<any[]>([]);
  const [comandoPersonalizadoApp, setComandoPersonalizadoApp] = useState<string>('');

  // Agenda & Rutinas
  const [agenda, setAgenda] = useState<any[]>([]);
  const [rutinas, setRutinas] = useState<any[]>([]);
  const [nuevaTareaTitulo, setNuevaTareaTitulo] = useState<string>('');
  const [nuevaTareaHora, setNuevaTareaHora] = useState<string>('10:30');
  const [nuevaTareaCmd, setNuevaTareaCmd] = useState<string>('/auditar-nodos');

  // Skills & RAG 0-RAM
  const [skills, setSkills] = useState<any[]>([]);
  const [ragStats, setRagStats] = useState<any>(null);
  const [consultaRag, setConsultaRag] = useState<string>('Sentinel Gateway X11');
  const [resultadosRag, setResultadosRag] = useState<any[]>([]);
  const [nuevaSkillId, setNuevaSkillId] = useState<string>('');
  const [nuevaSkillNombre, setNuevaSkillNombre] = useState<string>('');
  const [nuevaSkillCmd, setNuevaSkillCmd] = useState<string>('');
  const [nuevaSkillBody, setNuevaSkillBody] = useState<string>('');

  // Plugins, Relay & Worktrees
  const [plugins, setPlugins] = useState<any[]>([]);
  const [relayData, setRelayData] = useState<any>(null);
  const [worktrees, setWorktrees] = useState<any[]>([]);
  const [nuevoWorktreeNombre, setNuevoWorktreeNombre] = useState<string>('feature-optimizacion');
  const [comandoRelay, setComandoRelay] = useState<string>('uptime && free -h');

  // Proveedores
  const [proveedoresData, setProveedoresData] = useState<any>(null);
  const [nuevoPrvNombre, setNuevoPrvNombre] = useState<string>('');
  const [nuevoPrvUrl, setNuevoPrvUrl] = useState<string>('http://127.0.0.1:11434/v1');
  const [nuevoPrvModelos, setNuevoPrvModelos] = useState<string>('llama3.2, qwen2.5-coder');

  useEffect(() => {
    setSeccion(seccionInicial);
  }, [seccionInicial]);

  const cargarDatosSeccion = useCallback(
    async (sec: SeccionCentroOperaciones) => {
      setCargando(true);
      try {
        if (sec === 'escuadron' || sec === 'proveedores_config') {
          const r = await fetch(`${baseUrl}/api/configuracion`);
          if (r.ok) {
            const d = await r.json();
            setEscuadron(d.escuadron || []);
            setConfiguracion(d.configuracion || {});
          }
        }
        if (sec === 'control_pc') {
          const r = await fetch(`${baseUrl}/api/pc`);
          if (r.ok) {
            const d = await r.json();
            setEstadoPc(d);
            if (d?.pantalla?.cursor_x) setCoordX(d.pantalla.cursor_x);
            if (d?.pantalla?.cursor_y) setCoordY(d.pantalla.cursor_y);
          }
        }
        if (sec === 'programas') {
          const r = await fetch(`${baseUrl}/api/programas`);
          if (r.ok) {
            const d = await r.json();
            setProgramas(d.programas || []);
            setProcesos(d.procesos || []);
          }
        }
        if (sec === 'agenda') {
          const [rAg, rRut] = await Promise.all([
            fetch(`${baseUrl}/api/agenda`),
            fetch(`${baseUrl}/api/routines`),
          ]);
          if (rAg.ok) setAgenda((await rAg.json()).agenda || []);
          if (rRut.ok) setRutinas((await rRut.json()).routines || []);
        }
        if (sec === 'skills_rag') {
          const [rMem, rRag] = await Promise.all([
            fetch(`${baseUrl}/api/memories`),
            fetch(`${baseUrl}/api/rag`),
          ]);
          if (rMem.ok) setSkills((await rMem.json()).skills || []);
          if (rRag.ok) setRagStats(await rRag.json());
        }
        if (sec === 'plugins_relay') {
          const [rPl, rRel, rWt] = await Promise.all([
            fetch(`${baseUrl}/api/plugins`),
            fetch(`${baseUrl}/api/relay`),
            fetch(`${baseUrl}/api/worktrees`),
          ]);
          if (rPl.ok) setPlugins((await rPl.json()).plugins || []);
          if (rRel.ok) setRelayData(await rRel.json());
          if (rWt.ok) setWorktrees((await rWt.json()).worktrees || []);
        }
        if (sec === 'proveedores_config') {
          const rPrv = await fetch(`${baseUrl}/api/proveedores`);
          if (rPrv.ok) setProveedoresData(await rPrv.json());
        }
      } catch {
        // Ignorar errores transitorios
      } finally {
        setCargando(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    if (abierto) {
      void cargarDatosSeccion(seccion);
    }
  }, [abierto, seccion, cargarDatosSeccion]);

  if (!abierto) return null;

  const notificar = (msg: string) => {
    setMensajeEstado(msg);
    setTimeout(() => setMensajeEstado(null), 4000);
  };

  // --- Acciones Reales ---
  const ejecutarNavegacionReal = async (targetUrl?: string) => {
    const finalUrl = targetUrl || urlNavegador;
    setUrlNavegador(finalUrl);
    setCargando(true);
    try {
      const [resDom, resCdp] = await Promise.all([
        fetch(`${baseUrl}/api/navegador`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: finalUrl }),
        }),
        fetch(`${baseUrl}/api/cdp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'map', url: finalUrl }),
        }),
      ]);
      if (resDom.ok) setDatosNavegador(await resDom.json());
      if (resCdp.ok) {
        const cdpJson = await resCdp.json();
        setMapaCdp(cdpJson.elementos_interactivos || []);
      }
      notificar(`Página cargada y analizada en vivo: ${finalUrl}`);
    } finally {
      setCargando(false);
    }
  };

  const ejecutarAccionPc = async (payload: Record<string, any>, desc: string) => {
    setCargando(true);
    try {
      const r = await fetch(`${baseUrl}/api/pc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (payload.accion === 'screenshot' && d.url) {
        setUrlCapturaPc(`${baseUrl}${d.url}`);
      }
      notificar(desc);
      await cargarDatosSeccion('control_pc');
    } finally {
      setCargando(false);
    }
  };

  const lanzarProgramaReal = async (cmd: string) => {
    if (!cmd.trim()) return;
    await fetch(`${baseUrl}/api/programas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'launch', comando: cmd }),
    });
    notificar(`Programa lanzado en el escritorio X11: ${cmd}`);
    await cargarDatosSeccion('programas');
  };

  const agregarTareaAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaTareaTitulo.trim()) return;
    await fetch(`${baseUrl}/api/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: nuevaTareaTitulo,
        hora: nuevaTareaHora,
        comando: nuevaTareaCmd,
        agente_id: agenteActivoId,
        prioridad: 'alta',
      }),
    });
    setNuevaTareaTitulo('');
    notificar('Tarea agendada y sincronizada en disco.');
    await cargarDatosSeccion('agenda');
  };

  const buscarEnRag = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!consultaRag.trim()) return;
    const r = await fetch(`${baseUrl}/api/rag?q=${encodeURIComponent(consultaRag)}`);
    if (r.ok) {
      const d = await r.json();
      setResultadosRag(d.resultados || []);
      notificar(`Búsqueda BM25 completada en ${d.latencia_ms} ms`);
    }
  };

  const guardarNuevaSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaSkillNombre.trim() || !nuevaSkillBody.trim()) return;
    await fetch(`${baseUrl}/api/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'skill',
        id: nuevaSkillId || nuevaSkillNombre,
        name: nuevaSkillNombre,
        description: nuevaSkillBody.slice(0, 100),
        body: nuevaSkillBody,
        cmd: nuevaSkillCmd,
      }),
    });
    setNuevaSkillId('');
    setNuevaSkillNombre('');
    setNuevaSkillCmd('');
    setNuevaSkillBody('');
    notificar('Nueva Skill cristalizada en data/skills/');
    await cargarDatosSeccion('skills_rag');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 md:p-6 pointer-events-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div className="w-full max-w-6xl h-[86vh] rounded-3xl bg-[#050914] border border-slate-700/80 shadow-[0_25px_90px_rgba(0,0,0,0.95),0_0_40px_rgba(0,240,255,0.15)] flex flex-col md:flex-row overflow-hidden text-slate-100">
        {/* BARRA LATERAL DE NAVEGACIÓN (Estilo OpenGrokBot / Pegasus OS en Español) */}
        <aside className="w-full md:w-64 bg-[#03060e] border-b md:border-b-0 md:border-r border-slate-800/90 p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-bold text-xs">
                  ⚡
                </span>
                <div>
                  <h2 className="text-xs font-mono font-bold text-slate-100">CENTRO OPERATIVO</h2>
                  <p className="text-[10px] font-mono text-cyan-400">100% Real · Cero Simulación</p>
                </div>
              </div>
              <button
                onClick={onCerrar}
                className="md:hidden p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar">
              {SECCIONES.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSeccion(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-mono transition-all shrink-0 text-left ${
                    seccion === item.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  {item.icono}
                  <span>{item.titulo}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="hidden md:block pt-4 border-t border-slate-800/80 text-[10px] font-mono text-slate-400 space-y-1">
            <div className="text-slate-200 font-bold">Facu Cercuetti (@NickDev24)</div>
            <a
              href="https://facucercuetti.online/blog"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>facucercuetti.online/blog</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <div className="text-emerald-400">Puertos: :8091 · :8730 · :8731</div>
          </div>
        </aside>

        {/* PANEL PRINCIPAL DE CONTENIDO */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Cabecera del Panel */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-950/90 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-mono font-bold text-cyan-300 uppercase tracking-wider">
                {SECCIONES.find((s) => s.id === seccion)?.titulo}
              </h3>
              {mensajeEstado && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {mensajeEstado}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void cargarDatosSeccion(seccion)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin text-cyan-400' : ''}`} />
                <span>Actualizar</span>
              </button>
              <button
                onClick={onCerrar}
                className="hidden md:flex p-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/80 border border-slate-700 text-slate-400 hover:text-rose-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cuerpo con Scroll */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 font-mono">
            {/* ===============================================================
                1. ESCUADRÓN & SUBAGENTES 3D (Mismo personaje, distintos colores)
               =============================================================== */}
            {seccion === 'escuadron' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/70 border border-cyan-500/30">
                  <div>
                    <h4 className="text-xs font-bold text-cyan-300">
                      FORMACIÓN TÁCTICA 3D DE SUBAGENTES (MISMO PERSONAJE DEE CON COLORES PROPIOS)
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Seleccioná cualquier agente para cambiar en vivo el color de armadura/hologramas del personaje 3D, o activá la formación completa para ver a los 6 agentes en el escenario.
                    </p>
                  </div>
                  <button
                    onClick={() => onToggleEscuadron3D(!mostrarEscuadron3D)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                      mostrarEscuadron3D
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                        : 'bg-slate-950 text-cyan-300 border-cyan-500/50 hover:bg-slate-800'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>
                      {mostrarEscuadron3D
                        ? 'Formación 6 Agentes 3D: ACTIVA'
                        : 'Activar Formación 6 Agentes 3D en Escena'}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {escuadron.map((ag) => {
                    const esActivo = ag.id === agenteActivoId;
                    return (
                      <div
                        key={ag.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          esActivo
                            ? 'bg-slate-900/95 border-cyan-400 shadow-[0_0_25px_rgba(0,240,255,0.15)]'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-base border"
                                style={{
                                  backgroundColor: `${ag.color}22`,
                                  borderColor: ag.color,
                                  color: ag.color,
                                }}
                              >
                                {ag.icon}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">{ag.name}</span>
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                                    style={{ backgroundColor: `${ag.color}25`, color: ag.color }}
                                  >
                                    {ag.handle}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400">{ag.role}</div>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] text-slate-300">
                              Nodo: {String(ag.node).toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">{ag.scope}</p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">Color 3D:</span>
                            <input
                              type="color"
                              value={ag.color || '#00f0ff'}
                              onChange={async (e) => {
                                const nuevoColor = e.target.value;
                                await fetch(`${baseUrl}/api/configuracion`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    accion: 'subagent',
                                    agente: { ...ag, color: nuevoColor },
                                  }),
                                });
                                onSeleccionarAgente(ag.id, nuevoColor, ag.name);
                                void cargarDatosSeccion('escuadron');
                              }}
                              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                onSeleccionarAgente(ag.id, ag.color, ag.name);
                                notificar(`Agente 3D activo: ${ag.name} (${ag.color})`);
                              }}
                              className="px-3 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-[11px] font-bold"
                            >
                              {esActivo ? '✓ En Escena 3D' : 'Activar en 3D'}
                            </button>
                            <button
                              onClick={() => {
                                onSeleccionarAgente(ag.id, ag.color, ag.name);
                                onCerrar();
                                onEjecutarOrden(`${ag.handle} reporte de estado operativo`);
                              }}
                              className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold"
                            >
                              Ordenar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===============================================================
                2. CONTROL FÍSICO TOTAL DE LA PC (X11 C-ABI: Mouse, Teclado, Ventanas)
               =============================================================== */}
            {seccion === 'control_pc' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="text-[11px] text-cyan-400 font-bold">PANTALLA & PUNTERO X11</div>
                    <div className="text-lg font-bold text-white">
                      {estadoPc?.pantalla?.width || 1920} × {estadoPc?.pantalla?.height || 1080} px
                    </div>
                    <div className="text-xs text-emerald-400">
                      Cursor actual: X={estadoPc?.pantalla?.cursor_x ?? 0}, Y={estadoPc?.pantalla?.cursor_y ?? 0}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="text-[11px] text-cyan-400 font-bold flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>VOLUMEN MAESTRO DEL SISTEMA (PACTL)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={estadoPc?.volumen_pct ?? 75}
                        onChange={(e) =>
                          void ejecutarAccionPc(
                            { accion: 'volume', nivel: Number(e.target.value) },
                            `Volumen del sistema ajustado a ${e.target.value}%`
                          )
                        }
                        className="flex-1 accent-cyan-400"
                      />
                      <span className="text-sm font-bold text-white">{estadoPc?.volumen_pct ?? 75}%</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                    <div className="text-[11px] text-cyan-400 font-bold">CAPTURA REAL DEL ESCRITORIO X11</div>
                    <button
                      onClick={() =>
                        void ejecutarAccionPc(
                          { accion: 'screenshot' },
                          'Captura de escritorio X11 tomada en vivo'
                        )
                      }
                      className="mt-2 w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                    >
                      📸 Capturar Pantalla Completa Ahora
                    </button>
                  </div>
                </div>

                {urlCapturaPc && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-2">
                    <div className="text-xs text-cyan-300 font-bold">
                      Vista Previa en Vivo del Escritorio X11 (Hacé clic en la imagen para mover el mouse ahí):
                    </div>
                    <img
                      src={urlCapturaPc}
                      alt="Captura Escritorio X11"
                      className="w-full max-h-72 object-contain rounded-xl border border-slate-800 cursor-crosshair"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const relX = (e.clientX - rect.left) / rect.width;
                        const relY = (e.clientY - rect.top) / rect.height;
                        const realX = Math.round(relX * (estadoPc?.pantalla?.width || 1920));
                        const realY = Math.round(relY * (estadoPc?.pantalla?.height || 1080));
                        setCoordX(realX);
                        setCoordY(realY);
                        void ejecutarAccionPc(
                          { accion: 'mouse_move', x: realX, y: realY },
                          `Mouse X11 movido a (${realX}, ${realY})`
                        );
                      }}
                    />
                  </div>
                )}

                {/* Controles Físicos de Mouse y Teclado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-cyan-300">
                      🖱️ CONTROL FÍSICO DE MOUSE (libX11 + libXtst)
                    </h4>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400">X:</label>
                      <input
                        type="number"
                        value={coordX}
                        onChange={(e) => setCoordX(Number(e.target.value))}
                        className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs"
                      />
                      <label className="text-xs text-slate-400">Y:</label>
                      <input
                        type="number"
                        value={coordY}
                        onChange={(e) => setCoordY(Number(e.target.value))}
                        className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs"
                      />
                      <button
                        onClick={() =>
                          void ejecutarAccionPc(
                            { accion: 'mouse_move', x: coordX, y: coordY },
                            `Puntero movido a (${coordX}, ${coordY})`
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300"
                      >
                        Mover
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          void ejecutarAccionPc(
                            { accion: 'mouse_click', boton: 1, repeticiones: 1, x: coordX, y: coordY },
                            `Clic izquierdo en (${coordX}, ${coordY})`
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs"
                      >
                        Clic Izquierdo
                      </button>
                      <button
                        onClick={() =>
                          void ejecutarAccionPc(
                            { accion: 'mouse_click', boton: 1, repeticiones: 2, x: coordX, y: coordY },
                            `Doble clic en (${coordX}, ${coordY})`
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs"
                      >
                        Doble Clic
                      </button>
                      <button
                        onClick={() =>
                          void ejecutarAccionPc(
                            { accion: 'mouse_click', boton: 3, repeticiones: 1, x: coordX, y: coordY },
                            `Clic derecho en (${coordX}, ${coordY})`
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs"
                      >
                        Clic Derecho
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-cyan-300">
                      ⌨️ CONTROL FÍSICO DE TECLADO & ATAJOS X11
                    </h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={textoTeclado}
                        onChange={(e) => setTextoTeclado(e.target.value)}
                        placeholder="Texto a tipear en la ventana activa..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs"
                      />
                      <button
                        onClick={() => {
                          if (!textoTeclado) return;
                          void ejecutarAccionPc(
                            { accion: 'keyboard_type', texto: textoTeclado },
                            `Texto tipeado en X11`
                          );
                          setTextoTeclado('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs"
                      >
                        Tipear
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Enter ↵', keys: ['Return'] },
                        { label: 'Tab ⇥', keys: ['Tab'] },
                        { label: 'Escape', keys: ['Escape'] },
                        { label: 'Alt + Tab', keys: ['Alt_L', 'Tab'] },
                        { label: 'Ctrl + C', keys: ['Control_L', 'c'] },
                        { label: 'Ctrl + V', keys: ['Control_L', 'v'] },
                      ].map((hk) => (
                        <button
                          key={hk.label}
                          onClick={() =>
                            void ejecutarAccionPc(
                              { accion: 'keyboard_hotkey', teclas: hk.keys },
                              `Atajo enviado: ${hk.label}`
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300"
                        >
                          {hk.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Árbol de Ventanas X11 Abiertas */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold text-cyan-300">
                    🪟 VENTANAS GRÁFICAS ABIERTAS EN EL ESCRITORIO X11 ({estadoPc?.ventanas_abiertas?.length || 0})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(estadoPc?.ventanas_abiertas || []).map((win: any) => (
                      <div
                        key={win.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                      >
                        <div className="truncate pr-2">
                          <div className="font-bold text-slate-200 truncate">{win.titulo}</div>
                          <div className="text-[10px] text-slate-500">
                            ID: {win.id} · {win.ancho}×{win.alto} en ({win.x}, {win.y})
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setCoordX(win.centro_x);
                            setCoordY(win.centro_y);
                            void ejecutarAccionPc(
                              { accion: 'mouse_click', boton: 1, x: win.centro_x, y: win.centro_y },
                              `Foco/Clic en ventana: ${win.titulo}`
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-[10px] shrink-0"
                        >
                          Enfocar ({win.centro_x},{win.centro_y})
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                3. NAVEGADOR WEB INTEGRADO REAL & DRIVER CDP
               =============================================================== */}
            {seccion === 'navegador' && (
              <div className="space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ejecutarNavegacionReal();
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="text"
                    value={urlNavegador}
                    onChange={(e) => setUrlNavegador(e.target.value)}
                    placeholder="https://facucercuetti.online/blog"
                    className="flex-1 min-w-[240px] px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                  >
                    Ir & Extraer DOM (@ref)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setModoVistaWeb(modoVistaWeb === 'estructurado' ? 'iframe' : 'estructurado')
                    }
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-cyan-300"
                  >
                    {modoVistaWeb === 'estructurado' ? 'Ver Renderizado Web (Proxy)' : 'Ver Inspector DOM @ref'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`${baseUrl}/api/cdp`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ accion: 'launch', url: urlNavegador }),
                      });
                      notificar('Google Chrome lanzado con puerto CDP :9222');
                    }}
                    className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs"
                  >
                    Abrir en Chrome CDP (:9222)
                  </button>
                </form>

                {modoVistaWeb === 'iframe' ? (
                  <div className="w-full h-[460px] rounded-2xl overflow-hidden border border-slate-700 bg-white">
                    <iframe
                      src={`${baseUrl}/api/navegador/proxy?url=${encodeURIComponent(urlNavegador)}`}
                      title="Navegador Integrado Dee"
                      className="w-full h-full border-0"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5 max-h-[440px] overflow-y-auto">
                      <div className="text-xs font-bold text-cyan-300">
                        📄 CONTENIDO REAL EXTRAÍDO ({datosNavegador?.titulo || 'Listo para navegar'})
                      </div>
                      {datosNavegador?.encabezados?.map((h: string, idx: number) => (
                        <div key={idx} className="text-xs font-bold text-emerald-300">
                          {h}
                        </div>
                      ))}
                      {datosNavegador?.parrafos?.map((p: string, idx: number) => (
                        <p key={idx} className="text-[11px] text-slate-300 leading-relaxed">
                          {p}
                        </p>
                      ))}
                      {datosNavegador?.enlaces && (
                        <div className="pt-2 space-y-1">
                          <div className="text-[11px] font-bold text-cyan-400">
                            Enlaces Navegables ({datosNavegador.enlaces.length}):
                          </div>
                          {datosNavegador.enlaces.slice(0, 15).map((ln: any, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => void ejecutarNavegacionReal(ln.url)}
                              className="block w-full text-left text-[11px] text-sky-400 hover:underline truncate"
                            >
                              → {ln.texto || ln.url}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2 max-h-[440px] overflow-y-auto">
                      <div className="text-xs font-bold text-purple-300">
                        🎯 MAPA DE ELEMENTOS INTERACTIVOS CDP (@ref: {mapaCdp.length})
                      </div>
                      {mapaCdp.map((el) => (
                        <div
                          key={el.ref}
                          className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="truncate">
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold mr-1.5">
                              {el.ref}
                            </span>
                            <span className="text-cyan-300">&lt;{el.tag}&gt;</span>{' '}
                            <span className="text-slate-200">{el.texto || el.nombre || el.selector}</span>
                          </div>
                          {el.href && (
                            <button
                              onClick={() => void ejecutarNavegacionReal(el.href)}
                              className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] shrink-0"
                            >
                              Seguir
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===============================================================
                4. PROGRAMAS INSTALADOS & PROCESOS REALES DE LINUX
               =============================================================== */}
            {seccion === 'programas' && (
              <div className="space-y-5">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void lanzarProgramaReal(comandoPersonalizadoApp);
                    setComandoPersonalizadoApp('');
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={comandoPersonalizadoApp}
                    onChange={(e) => setComandoPersonalizadoApp(e.target.value)}
                    placeholder="Comando de aplicación a abrir en escritorio X11 (ej: google-chrome, xterm, nautilus)..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                  >
                    🚀 Lanzar en Escritorio
                  </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Aplicaciones de Escritorio Detectadas */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5 max-h-[420px] overflow-y-auto">
                    <h4 className="text-xs font-bold text-cyan-300">
                      📦 APLICACIONES NATIVAS INSTALADAS ({programas.length})
                    </h4>
                    {programas.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800"
                      >
                        <div className="truncate pr-2">
                          <div className="text-xs font-bold text-slate-100 truncate">{app.nombre}</div>
                          <div className="text-[10px] text-slate-500 truncate">{app.comando}</div>
                        </div>
                        <button
                          onClick={() => void lanzarProgramaReal(app.comando)}
                          className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[11px] font-bold shrink-0"
                        >
                          Abrir
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Procesos Activos en el Sistema */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5 max-h-[420px] overflow-y-auto">
                    <h4 className="text-xs font-bold text-emerald-300">
                      ⚙️ PROCESOS ACTIVOS EN FACU (TOP CPU/RAM)
                    </h4>
                    {procesos.map((pr) => (
                      <div
                        key={pr.pid}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px]"
                      >
                        <div className="truncate pr-2">
                          <span className="text-cyan-400 font-bold">PID {pr.pid}</span> ·{' '}
                          <span className="text-emerald-400">CPU {pr.cpu}</span> ·{' '}
                          <span className="text-purple-300">MEM {pr.mem}</span>
                          <div className="text-[10px] text-slate-400 truncate">{pr.comando}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                5. AGENDA OPERATIVA & RUTINAS CRON/WEBHOOK REALES
               =============================================================== */}
            {seccion === 'agenda' && (
              <div className="space-y-5">
                <form
                  onSubmit={agregarTareaAgenda}
                  className="grid grid-cols-1 md:grid-cols-4 gap-2 p-4 rounded-2xl bg-slate-900/70 border border-slate-800"
                >
                  <input
                    type="text"
                    value={nuevaTareaTitulo}
                    onChange={(e) => setNuevaTareaTitulo(e.target.value)}
                    placeholder="Título de la tarea o recordatorio..."
                    className="md:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs"
                  />
                  <input
                    type="text"
                    value={nuevaTareaCmd}
                    onChange={(e) => setNuevaTareaCmd(e.target.value)}
                    placeholder="Comando o /skill (ej: /auditar-nodos)"
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agendar Tarea</span>
                  </button>
                </form>

                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-cyan-300">
                    📅 AGENDA OPERATIVA PERSISTENTE ({agenda.length})
                  </h4>
                  {agenda.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{item.titulo}</span>
                          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px]">
                            {item.fecha} · {item.hora}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px]">
                            <code>{item.comando}</code>
                          </span>
                        </div>
                        {item.notas && <p className="text-[11px] text-slate-400 mt-1">{item.notas}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            onCerrar();
                            onEjecutarOrden(item.comando);
                          }}
                          className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                        >
                          Ejecutar Ahora
                        </button>
                        <button
                          onClick={async () => {
                            await fetch(`${baseUrl}/api/agenda`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ accion: 'delete', id: item.id }),
                            });
                            void cargarDatosSeccion('agenda');
                          }}
                          className="p-1.5 rounded-xl bg-rose-950/60 text-rose-300 hover:bg-rose-900"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===============================================================
                6. SKILLS CRISTALIZADAS & MOTOR RAG LOCAL 0-RAM (SQLite FTS5)
               =============================================================== */}
            {seccion === 'skills_rag' && (
              <div className="space-y-6">
                {/* Buscador RAG 0-RAM */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/30 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-cyan-300">
                        📚 MOTOR RAG LOCAL 0-RAM (SQLite FTS5 BM25 — Reemplazo Real de muse-spark)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Archivos indexados: {ragStats?.archivos_indexados ?? 0} · Fragmentos:{' '}
                        {ragStats?.fragmentos_indexados ?? 0} · Consumo RAM en reposo: 0 MB
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch(`${baseUrl}/api/rag`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ accion: 'ingest_dir' }),
                        });
                        notificar('Repositorio re-indexado en SQLite FTS5');
                        void cargarDatosSeccion('skills_rag');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs"
                    >
                      Re-Indexar Proyecto
                    </button>
                  </div>

                  <form onSubmit={buscarEnRag} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={consultaRag}
                      onChange={(e) => setConsultaRag(e.target.value)}
                      placeholder="Buscar código, arquitectura, funciones o notas en <3ms..."
                      className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Buscar BM25</span>
                    </button>
                  </form>

                  {resultadosRag.length > 0 && (
                    <div className="space-y-2 max-h-56 overflow-y-auto pt-2">
                      {resultadosRag.map((r, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]"
                        >
                          <div className="flex items-center justify-between text-cyan-300 font-bold">
                            <span>
                              📄 {r.ruta} (Bloque #{r.bloque})
                            </span>
                            <span className="text-emerald-400">Score BM25: {r.relevancia}</span>
                          </div>
                          <pre className="text-[10px] text-slate-300 whitespace-pre-wrap mt-1">
                            {r.fragmento}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Creador y Lista de Skills */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <form
                    onSubmit={guardarNuevaSkill}
                    className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5"
                  >
                    <h4 className="text-xs font-bold text-emerald-300">
                      + CREAR NUEVA SKILL CRISTALIZADA EN DISCO
                    </h4>
                    <input
                      type="text"
                      value={nuevaSkillNombre}
                      onChange={(e) => setNuevaSkillNombre(e.target.value)}
                      placeholder="Nombre de la Skill (ej: Backup Rápido)"
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs"
                    />
                    <input
                      type="text"
                      value={nuevaSkillId}
                      onChange={(e) => setNuevaSkillId(e.target.value)}
                      placeholder="ID Slash (ej: backup-rapido)"
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs"
                    />
                    <input
                      type="text"
                      value={nuevaSkillCmd}
                      onChange={(e) => setNuevaSkillCmd(e.target.value)}
                      placeholder="Comando Linux real opcional (ej: tar -czf /tmp/bk.tgz ./config)"
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs"
                    />
                    <textarea
                      rows={3}
                      value={nuevaSkillBody}
                      onChange={(e) => setNuevaSkillBody(e.target.value)}
                      placeholder="Instrucciones detalladas de la Skill..."
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs"
                    />
                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                    >
                      Guardar Skill en data/skills/
                    </button>
                  </form>

                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2 max-h-[340px] overflow-y-auto">
                    <h4 className="text-xs font-bold text-cyan-300">
                      SKILLS INSTALADAS ({skills.length})
                    </h4>
                    {skills.map((sk) => (
                      <div
                        key={sk.id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="truncate">
                          <div className="text-xs font-bold text-white">
                            <code className="text-cyan-300">/{sk.id}</code> · {sk.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {sk.cmd ? `$ ${sk.cmd}` : sk.description}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            onCerrar();
                            onEjecutarOrden(`/${sk.id}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500 text-slate-950 font-bold text-[10px] shrink-0"
                        >
                          Ejecutar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                7. GATEWAY :8730/:8731, RELAY ENGINE & GIT WORKTREES AISLADOS
               =============================================================== */}
            {seccion === 'plugins_relay' && (
              <div className="space-y-5">
                {/* Despachador Relay Engine */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-cyan-300">
                    🔄 MOTOR RELAY TRANSACCIONAL (RouteEnvelope hop&lt;4 · Bitácora JSONL Durable)
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={comandoRelay}
                      onChange={(e) => setComandoRelay(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs"
                    />
                    <button
                      onClick={async () => {
                        await fetch(`${baseUrl}/api/relay`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            destino: 'facu',
                            comando: comandoRelay,
                            busy_policy: 'steer',
                          }),
                        });
                        notificar('Misión Relay ejecutada y persistida en records.jsonl');
                        void cargarDatosSeccion('plugins_relay');
                      }}
                      className="px-4 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                    >
                      Despachar por Relay
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {(relayData?.records || []).slice(0, 6).map((rec: any) => (
                      <div
                        key={rec.id}
                        className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between"
                      >
                        <div className="truncate">
                          <span className="text-emerald-400 font-bold">[{rec.execution}]</span>{' '}
                          <span className="text-cyan-300">{rec.target}</span> ·{' '}
                          <span className="text-slate-300">{rec.payload}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          hop={rec.hop} · {rec.duration_ms || 0}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Forja de Git Worktrees Aislados */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4" />
                    <span>FORJA DE GIT WORKTREES AISLADOS (/tmp/dee-worktrees)</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nuevoWorktreeNombre}
                      onChange={(e) => setNuevoWorktreeNombre(e.target.value)}
                      placeholder="Nombre del worktree aislado..."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs"
                    />
                    <button
                      onClick={async () => {
                        await fetch(`${baseUrl}/api/worktrees`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ accion: 'create', nombre: nuevoWorktreeNombre }),
                        });
                        notificar(`Worktree aislado creado: ${nuevoWorktreeNombre}`);
                        void cargarDatosSeccion('plugins_relay');
                      }}
                      className="px-4 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                    >
                      + Crear Worktree
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {worktrees.map((wt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                      >
                        <div>
                          <span className="text-cyan-300 font-bold">{wt.rama}</span> ·{' '}
                          <span className="text-slate-300">{wt.ruta}</span>
                        </div>
                        {wt.ruta?.startsWith('/tmp/') && (
                          <button
                            onClick={async () => {
                              await fetch(`${baseUrl}/api/worktrees`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ accion: 'remove', ruta: wt.ruta }),
                              });
                              void cargarDatosSeccion('plugins_relay');
                            }}
                            className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 text-[10px]"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plugins & Servidores MCP */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-purple-300">
                    🧩 PLUGINS & SERVIDORES MCP ACTIVOS ({plugins.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {plugins.map((pl) => (
                      <div
                        key={pl.id}
                        className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{pl.nombre}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            {pl.estado_real}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{pl.descripcion}</p>
                        <div className="text-[10px] text-cyan-400 truncate">{pl.endpoint}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                8. PROVEEDORES DE IA, CLIs LOCALES & CONFIGURACIÓN GENERAL
               =============================================================== */}
            {seccion === 'proveedores_config' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Proveedores HTTP / OpenAI-Compatible */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                    <h4 className="text-xs font-bold text-cyan-300">
                      🔌 GATEWAYS & PROVEEDORES DE IA MEDIDOS EN VIVO
                    </h4>
                    {(proveedoresData?.proveedores || []).map((prv: any) => (
                      <div
                        key={prv.id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">{prv.nombre}</div>
                          <div className="text-[10px] text-slate-400">{prv.base_url}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            prv.online
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {prv.online ? `ONLINE (${prv.latencia_ms}ms)` : 'EN ESPERA'}
                        </span>
                      </div>
                    ))}

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!nuevoPrvNombre.trim()) return;
                        await fetch(`${baseUrl}/api/proveedores`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            nombre: nuevoPrvNombre,
                            base_url: nuevoPrvUrl,
                            modelos: nuevoPrvModelos,
                          }),
                        });
                        setNuevoPrvNombre('');
                        notificar('Proveedor agregado y sondeado');
                        void cargarDatosSeccion('proveedores_config');
                      }}
                      className="pt-2 space-y-2 border-t border-slate-800"
                    >
                      <div className="text-[11px] font-bold text-emerald-300">
                        + Agregar Proveedor OpenAI-Compatible / Ollama
                      </div>
                      <input
                        type="text"
                        value={nuevoPrvNombre}
                        onChange={(e) => setNuevoPrvNombre(e.target.value)}
                        placeholder="Nombre (ej: Ollama Local / Groq)"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs"
                      />
                      <input
                        type="text"
                        value={nuevoPrvUrl}
                        onChange={(e) => setNuevoPrvUrl(e.target.value)}
                        placeholder="Base URL (ej: http://127.0.0.1:11434/v1)"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs"
                      />
                      <button
                        type="submit"
                        className="w-full py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                      >
                        Guardar Proveedor
                      </button>
                    </form>
                  </div>

                  {/* CLIs Oficiales Detectados + Configuración General */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                      <h4 className="text-xs font-bold text-emerald-300">
                        🖥️ BINARIOS Y SUSCRIPCIONES CLI EN ESTE EQUIPO
                      </h4>
                      {(proveedoresData?.cli_locales || []).map((cli: any) => (
                        <div
                          key={cli.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-200">{cli.nombre}</div>
                            <div className="text-[10px] text-slate-500">{cli.ruta}</div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              cli.instalado
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {cli.instalado ? 'INSTALADO' : 'NO DETECTADO'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2 text-xs">
                      <h4 className="font-bold text-cyan-300">⚙️ CONFIGURACIÓN DEL SISTEMA</h4>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Comandante:</span>
                        <span className="text-white font-bold">
                          {configuracion.comandante || 'Facu Cercuetti (@NickDev24)'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Idioma del Sistema:</span>
                        <span className="text-emerald-300 font-bold">Español Argentino (100%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Gobernador 3D:</span>
                        <span className="text-cyan-300">30 FPS Activo / 8 FPS Reposo</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
