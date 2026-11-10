import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CyberBirdCanvas } from './components/CyberBirdCanvas';
import { MuseVoiceOrb } from './components/MuseVoiceOrb';
import { MuseSubtitlePill } from './components/MuseSubtitlePill';
import {
  DraggableLiveTerminal,
  TerminalLogEntry,
} from './components/DraggableLiveTerminal';
import {
  CentroOperacionesRealesModal,
  SeccionCentroOperaciones,
} from './components/CentroOperacionesRealesModal';
import { Img2ThreejsElectronGuide } from './components/views/Img2ThreejsElectronGuide';
import { voiceEngine, BackendTTSChunk } from './services/voiceEngine';
import {
  JarvisAction,
  JarvisEmotion,
  VoiceLipSyncData,
} from './types/jarvis';
import {
  Camera,
  Terminal as TerminalIcon,
  Box,
  Send,
  Volume2,
  VolumeX,
  Ear,
  Eye,
  ShieldAlert,
  Sparkles,
  Wrench,
  ExternalLink,
  Users,
  MousePointer,
  Globe,
  Cpu,
  Calendar,
  Puzzle,
  Server,
} from 'lucide-react';

interface SkillItem {
  id: string;
  tier: 'primary' | 'secondary' | 'tertiary' | 'mode';
  icon: string;
  name: string;
  cmdPrompt: string;
  action: JarvisAction;
  emotion: JarvisEmotion;
  badgeColor: string;
}

interface SubagenteInfo {
  id: string;
  nombre: string;
  rol: string;
  color: string;
}

const ESCUADRON_3D: SubagenteInfo[] = [
  { id: 'dee_prime', nombre: 'Dee Prime', rol: 'Comandante Maestro', color: '#00f0ff' },
  { id: 'hermes_x11', nombre: 'Hermes X11', rol: 'Control PC & CDP', color: '#ec4899' },
  { id: 'barto_forge', nombre: 'Barto Forge', rol: 'Docker & Worktrees', color: '#10b981' },
  { id: 'manager_scout', nombre: 'Manager Scout', rol: 'Red LAN & Telemetría', color: '#f59e0b' },
  { id: 'sentinel_guard', nombre: 'Sentinel Guard', rol: 'Seguridad & Biometría', color: '#f43f5e' },
  { id: 'rakazo_archivist', nombre: 'Rakazo Archivist', rol: 'RAG 0-RAM & Agenda', color: '#a855f7' },
];

const ALL_SKILLS_AND_TOOLS: SkillItem[] = [
  // Habilidades Primarias (Clúster, Seguridad, RAM, Procesos, Control Físico PC X11)
  {
    id: 'auditar-nodos',
    tier: 'primary',
    icon: '⚡',
    name: '/auditar-nodos',
    cmdPrompt: '/auditar-nodos',
    action: 'manipular_datos',
    emotion: 'curioso',
    badgeColor: 'border-cyan-500/40 hover:border-cyan-400 text-cyan-300 bg-cyan-950/40',
  },
  {
    id: 'control-pc-x11',
    tier: 'primary',
    icon: '🖱️',
    name: '/control-pc-x11',
    cmdPrompt: '/control-pc-x11',
    action: 'trabajando',
    emotion: 'orgullo',
    badgeColor: 'border-pink-500/40 hover:border-pink-400 text-pink-300 bg-pink-950/40',
  },
  {
    id: 'hardening-seguridad',
    tier: 'primary',
    icon: '🛡️',
    name: '/hardening-seguridad',
    cmdPrompt: '/hardening-seguridad',
    action: 'explicacion',
    emotion: 'combate',
    badgeColor: 'border-rose-500/40 hover:border-rose-400 text-rose-300 bg-rose-950/40',
  },
  {
    id: 'limpiar-ram',
    tier: 'primary',
    icon: '🧹',
    name: '/limpiar-ram',
    cmdPrompt: '/limpiar-ram',
    action: 'trabajando',
    emotion: 'orgullo',
    badgeColor: 'border-emerald-500/40 hover:border-emerald-400 text-emerald-300 bg-emerald-950/40',
  },
  {
    id: 'procesos-top',
    tier: 'primary',
    icon: '📊',
    name: '/procesos-top',
    cmdPrompt: '/procesos-top',
    action: 'manipular_datos',
    emotion: 'curioso',
    badgeColor: 'border-sky-500/40 hover:border-sky-400 text-sky-300 bg-sky-950/40',
  },
  // Habilidades Secundarias (Docker, Git, LAN, Logs, RAG 0-RAM, CDP)
  {
    id: 'rag-memoria',
    tier: 'secondary',
    icon: '🧠',
    name: '/rag-memoria',
    cmdPrompt: '/rag-memoria',
    action: 'manipular_datos',
    emotion: 'curioso',
    badgeColor: 'border-violet-500/40 hover:border-violet-400 text-violet-300 bg-violet-950/40',
  },
  {
    id: 'cdp-mapa',
    tier: 'secondary',
    icon: '🌐',
    name: '/cdp-mapa',
    cmdPrompt: '/cdp-mapa',
    action: 'manipular_datos',
    emotion: 'curioso',
    badgeColor: 'border-cyan-500/40 hover:border-cyan-400 text-cyan-300 bg-cyan-950/40',
  },
  {
    id: 'docker-ops',
    tier: 'secondary',
    icon: '🐳',
    name: '/docker-ops',
    cmdPrompt: '/docker-ops',
    action: 'trabajando',
    emotion: 'orgullo',
    badgeColor: 'border-blue-500/40 hover:border-blue-400 text-blue-300 bg-blue-950/40',
  },
  {
    id: 'git-sync',
    tier: 'secondary',
    icon: '🌿',
    name: '/git-sync',
    cmdPrompt: '/git-sync',
    action: 'trabajando',
    emotion: 'curioso',
    badgeColor: 'border-purple-500/40 hover:border-purple-400 text-purple-300 bg-purple-950/40',
  },
  {
    id: 'red-lan-scan',
    tier: 'secondary',
    icon: '📡',
    name: '/red-lan-scan',
    cmdPrompt: '/red-lan-scan',
    action: 'manipular_datos',
    emotion: 'curioso',
    badgeColor: 'border-indigo-500/40 hover:border-indigo-400 text-indigo-300 bg-indigo-950/40',
  },
  {
    id: 'logs-vivo',
    tier: 'secondary',
    icon: '📜',
    name: '/logs-vivo',
    cmdPrompt: '/logs-vivo',
    action: 'trabajando',
    emotion: 'curioso',
    badgeColor: 'border-teal-500/40 hover:border-teal-400 text-teal-300 bg-teal-950/40',
  },
  // Habilidades Terciarias (Cámaras, Audio ALSA, Benchmark CPU, Test de Integridad)
  {
    id: 'camara-snapshot',
    tier: 'tertiary',
    icon: '👁️',
    name: '/camara-snapshot',
    cmdPrompt: '/camara-snapshot',
    action: 'explicacion',
    emotion: 'combate',
    badgeColor: 'border-amber-500/40 hover:border-amber-400 text-amber-300 bg-amber-950/40',
  },
  {
    id: 'audio-alsa-check',
    tier: 'tertiary',
    icon: '🎙️',
    name: '/audio-alsa-check',
    cmdPrompt: '/audio-alsa-check',
    action: 'manipular_datos',
    emotion: 'curioso',
    badgeColor: 'border-pink-500/40 hover:border-pink-400 text-pink-300 bg-pink-950/40',
  },
  {
    id: 'benchmark-cpu',
    tier: 'tertiary',
    icon: '🚀',
    name: '/benchmark-cpu',
    cmdPrompt: '/benchmark-cpu',
    action: 'celebracion_salto',
    emotion: 'orgullo',
    badgeColor: 'border-amber-500/40 hover:border-amber-400 text-amber-300 bg-amber-950/40',
  },
  {
    id: 'test-integridad',
    tier: 'tertiary',
    icon: '✅',
    name: '/test-integridad',
    cmdPrompt: '/test-integridad',
    action: 'celebracion_salto',
    emotion: 'orgullo',
    badgeColor: 'border-emerald-500/40 hover:border-emerald-400 text-emerald-300 bg-emerald-950/40',
  },
  // Modos Cognitivos (/plan, /grill, /goal)
  {
    id: 'mode-plan',
    tier: 'mode',
    icon: '🧭',
    name: '/plan Clúster 3 PCs',
    cmdPrompt: '/plan Optimizar distribución de carga entre facu, barto y manager1',
    action: 'manipular_datos',
    emotion: 'curioso',
    badgeColor: 'border-fuchsia-500/40 hover:border-fuchsia-400 text-fuchsia-300 bg-fuchsia-950/40',
  },
  {
    id: 'mode-grill',
    tier: 'mode',
    icon: '🔥',
    name: '/grill Auditoría',
    cmdPrompt: '/grill Auditar seguridad y resiliencia de los demonios :8091, :8730 y :8731',
    action: 'explicacion',
    emotion: 'combate',
    badgeColor: 'border-rose-500/40 hover:border-rose-400 text-rose-300 bg-rose-950/40',
  },
  {
    id: 'mode-goal',
    tier: 'mode',
    icon: '🎯',
    name: '/goal Diagnóstico Real',
    cmdPrompt: '/goal Verificar memoria libre y puertos activos en facu',
    action: 'trabajando',
    emotion: 'orgullo',
    badgeColor: 'border-emerald-500/40 hover:border-emerald-400 text-emerald-300 bg-emerald-950/40',
  },
];

const ACTION_LABELS: Record<JarvisAction, { title: string; subtitle: string; badge: string }> = {
  idle: {
    title: 'GUARDIA ACTIVA // REPOSO INTELIGENTE',
    subtitle: 'Respiración orgánica · Seguimiento ocular · 8–30 FPS adaptativos',
    badge: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/50',
  },
  trabajando: {
    title: 'EJECUTANDO EN TERMINAL // TECLADO HOLOGRÁFICO ACTIVO',
    subtitle: 'Tipeo láser articulado en tiempo real · Conectado a :8091 / :8730 / :8731',
    badge: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/60',
  },
  manipular_datos: {
    title: 'ANALIZANDO TELEMETRÍA & MEMORIA // ORBE CUÁNTICO',
    subtitle: 'Escaneo de clúster LAN (facu · barto · manager1) y RAG FTS5 0-RAM',
    badge: 'text-purple-300 border-purple-500/50 bg-purple-950/60',
  },
  explicacion: {
    title: 'MODO SENTINEL // AUDITORÍA & DEFENSA ACTIVA',
    subtitle: 'Postura táctica de combate · Inspección SAST y vigilancia visual',
    badge: 'text-rose-300 border-rose-500/50 bg-rose-950/60',
  },
  celebracion_salto: {
    title: 'TAREA COMPLETADA // SALTO & GIRO 360°',
    subtitle: 'Ejecución verificada con éxito en el workbench local',
    badge: 'text-amber-300 border-amber-500/50 bg-amber-950/60',
  },
  saludo: {
    title: 'RECONOCIMIENTO DE COMANDANTE // SALUDO',
    subtitle: 'Doble aplauso / Biometría de Facu Cercuetti verificada',
    badge: 'text-sky-300 border-sky-500/50 bg-sky-950/60',
  },
  despedida: {
    title: 'MODO AHORRO // VIGILANCIA SILENCIOSA',
    subtitle: 'Gobernador a 8 FPS · Oídos ALSA atentos al doble aplauso',
    badge: 'text-slate-300 border-slate-600/50 bg-slate-900/60',
  },
};

const ETIQUETAS_CAMARA: Record<'default' | 'closeup' | 'overview', string> = {
  default: 'Estándar',
  closeup: 'Primer Plano',
  overview: 'Panorámica',
};

export default function App() {
  const [showElectronGuide, setShowElectronGuide] = useState(false);
  const [selectedSkillTier, setSelectedSkillTier] = useState<'all' | 'primary' | 'secondary' | 'tertiary' | 'mode'>('all');

  // Estado del Centro de Operaciones Reales (8 Módulos Pegasus)
  const [centroOperacionesAbierto, setCentroOperacionesAbierto] = useState(false);
  const [seccionCentroOperaciones, setSeccionCentroOperaciones] =
    useState<SeccionCentroOperaciones>('escuadron');

  // Estado del Agente Activo y Escuadrón 3D (Mismo personaje 3D, diferentes colores)
  const [agenteActivoId, setAgenteActivoId] = useState<string>('dee_prime');
  const [agenteColor, setAgenteColor] = useState<string>('#00f0ff');
  const [agenteNombre, setAgenteNombre] = useState<string>('Dee Prime');
  const [mostrarEscuadron3D, setMostrarEscuadron3D] = useState<boolean>(false);

  // Cinemática 3D en Tiempo Real, Emoción y Cámara
  const [currentAction, setCurrentAction] = useState<JarvisAction>('idle');
  const [currentEmotion, setCurrentEmotion] = useState<JarvisEmotion>('curioso');
  const [cameraPreset, setCameraPreset] = useState<'default' | 'closeup' | 'overview'>('default');
  const [activeTaskLabel, setActiveTaskLabel] = useState<string>('Listo para ejecutar órdenes de Facu');

  // Terminal Flotante Movible en Vivo (Se despliega automáticamente con cada tarea)
  const [terminalOpen, setTerminalOpen] = useState<boolean>(true);
  const [terminalMinimized, setTerminalMinimized] = useState<boolean>(false);
  const [terminalEntries, setTerminalEntries] = useState<TerminalLogEntry[]>([
    {
      id: 'boot_welcome',
      ts: new Date().toLocaleTimeString(),
      target: 'facu',
      cmd: 'dee-bot-agents --estado --escuadron --gateway (v4.0 Pegasus Supreme)',
      stdout:
        '⚡ DEE-BOT-AGENTS v4.0 PEGASUS SUPREME EN LÍNEA\n' +
        '• Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog\n' +
        '• Demonios Reales Activos: Cerebro (:8091) · Gateway Archivos (:8730) · Workbench (:8731)\n' +
        '• Motores Nativos: Control Físico PC X11 (libX11/libXtst) · Driver CDP · RAG SQLite FTS5 0-RAM · Relay JSONL · Git Worktree Forge\n' +
        '• Escuadrón 3D: Dee Prime (#00f0ff) + 5 Subagentes Iguales con Colores Distintivos.',
      exitCode: 0,
      durationMs: 0.7,
      status: 'ok',
    },
  ]);

  // Estado en Vivo del Backend
  const [backendConnected, setBackendConnected] = useState(false);
  const [earsEnabled, setEarsEnabled] = useState(false);
  const [eyesEnabled, setEyesEnabled] = useState(false);
  const [tokensSaved, setTokensSaved] = useState<number>(600);
  const [clusterSummary, setClusterSummary] = useState('facu (Maestro) · Pool :3001 · 3 PCs');

  // Audio / Voz / Lip-Sync
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [speechText, setSpeechText] = useState(
    '¡Che Facu! Sistema Pegasus 100% en español activo: Control físico de PC en C/X11, Gateway atómico :8730, Workbench :8731, Driver CDP, RAG 0-RAM y tus 6 agentes 3D listos.'
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [lipSyncData, setLipSyncData] = useState<VoiceLipSyncData>({
    volume: 0,
    frequency: 0,
    viseme: 'neutral',
  });

  const ttsQueueRef = useRef<BackendTTSChunk[]>([]);
  const isPlayingQueueRef = useRef(false);
  const actionResetTimerRef = useRef<number | null>(null);

  const scheduleReturnToIdle = useCallback((delayMs = 4200) => {
    if (actionResetTimerRef.current) {
      window.clearTimeout(actionResetTimerRef.current);
    }
    actionResetTimerRef.current = window.setTimeout(() => {
      setCurrentAction('idle');
    }, delayMs);
  }, []);

  useEffect(() => {
    voiceEngine.setLipSyncCallback((data) => {
      setLipSyncData(data);
    });
  }, []);

  const processTtsQueue = useCallback(() => {
    if (isPlayingQueueRef.current) return;
    const next = ttsQueueRef.current.shift();
    if (!next) {
      setIsSpeaking(false);
      return;
    }
    isPlayingQueueRef.current = true;
    setSpeechText(next.text);
    setIsSpeaking(true);
    if (next.emotion) {
      setCurrentEmotion(next.emotion);
    }

    if (isAudioMuted) {
      setTimeout(() => {
        isPlayingQueueRef.current = false;
        processTtsQueue();
      }, 1400);
      return;
    }

    voiceEngine.playBackendChunk(next, () => {
      isPlayingQueueRef.current = false;
      processTtsQueue();
    });
  }, [isAudioMuted]);

  // Conexión SSE (/events) y Sondeo (/api/status)
  useEffect(() => {
    const baseUrl = voiceEngine.getBackendBaseUrl();
    let es: EventSource | null = null;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/status`);
        if (!res.ok) return;
        const data = await res.json();
        setBackendConnected(true);
        setEarsEnabled(Boolean(data?.sensory?.ears?.running));
        setEyesEnabled(Boolean(data?.sensory?.eyes?.running));
        if (typeof data?.llm_pool?.tokens_saved === 'number') {
          setTokensSaved(data.llm_pool.tokens_saved);
        }

        const nodes = data?.cluster?.nodes || {};
        const onlineCount = Object.values(nodes).filter((n: any) => n?.online).length;
        const facuCpu = nodes?.facu?.telemetry?.cpu_pct ?? 0;
        const facuRam = nodes?.facu?.telemetry?.ram_used_gb ?? 0;
        setClusterSummary(
          `Nodos en Línea: ${onlineCount}/3 · CPU facu: ${facuCpu}% · RAM: ${facuRam}GB`
        );
      } catch {
        setBackendConnected(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);

    try {
      es = new EventSource(`${baseUrl}/events`);
      es.onopen = () => setBackendConnected(true);
      es.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const { type, payload } = msg;

          if (type === 'character_state' && payload) {
            if (payload.action) {
              setCurrentAction(payload.action);
              if (payload.action !== 'idle') {
                scheduleReturnToIdle(5000);
              }
            }
            if (payload.emotion) setCurrentEmotion(payload.emotion);
            if (payload.note) setActiveTaskLabel(payload.note);
            if (typeof payload.is_listening === 'boolean') setIsListening(payload.is_listening);
          } else if (type === 'agent_changed' && payload) {
            if (payload.id) setAgenteActivoId(payload.id);
            if (payload.color) setAgenteColor(payload.color);
            if (payload.nombre) setAgenteNombre(payload.nombre);
          } else if (type === 'terminal_exec_start' && payload) {
            setTerminalOpen(true);
            setTerminalMinimized(false);
            setCurrentAction('trabajando');
            setActiveTaskLabel(`Ejecutando en ${payload.target || 'facu'}: ${payload.cmd}`);
            setTerminalEntries((prev) => [
              ...prev.slice(-35),
              {
                id: payload.id || `exec_${Date.now()}`,
                ts: new Date().toLocaleTimeString(),
                target: payload.target || 'facu',
                cmd: payload.cmd || '',
                status: 'running',
              },
            ]);
          } else if (type === 'terminal_exec_done' && payload) {
            setTerminalOpen(true);
            setTerminalMinimized(false);
            setTerminalEntries((prev) => {
              const idx = prev.findIndex((item) => item.id === payload.id);
              const updatedEntry: TerminalLogEntry = {
                id: payload.id || `done_${Date.now()}`,
                ts: new Date().toLocaleTimeString(),
                target: payload.target || 'facu',
                cmd: payload.cmd || '',
                stdout: payload.stdout || '',
                stderr: payload.stderr || '',
                exitCode: payload.exit_code ?? 0,
                durationMs: payload.duration_ms,
                status: payload.ok === false ? 'error' : 'ok',
              };
              if (idx >= 0) {
                const clone = [...prev];
                clone[idx] = updatedEntry;
                return clone;
              }
              return [...prev.slice(-35), updatedEntry];
            });
          } else if (type === 'tts_chunk' && payload?.text) {
            ttsQueueRef.current.push(payload);
            processTtsQueue();
          } else if (type === 'double_clap') {
            setCurrentAction('saludo');
            setCurrentEmotion('curioso');
            scheduleReturnToIdle(3500);
          } else if (type === 'vision_intruder_alert') {
            setCurrentAction('explicacion');
            setCurrentEmotion('combate');
          } else if (type === 'kill_switch_activated') {
            ttsQueueRef.current = [];
            isPlayingQueueRef.current = false;
            voiceEngine.stopSpeaking();
            setIsSpeaking(false);
            setCurrentAction('idle');
            setCurrentEmotion('alivio');
          }
        } catch {
          // Ignorar trama SSE malformada
        }
      };
    } catch {
      // Respaldo si SSE no está disponible
    }

    return () => {
      clearInterval(interval);
      if (es) es.close();
    };
  }, [processTtsQueue, scheduleReturnToIdle]);

  const speakDialogue = useCallback(
    (text: string, emotion: JarvisEmotion = 'curioso', onEnd?: () => void) => {
      setSpeechText(text);
      setIsSpeaking(true);
      setCurrentEmotion(emotion);

      if (isAudioMuted) {
        setTimeout(() => {
          setIsSpeaking(false);
          if (onEnd) onEnd();
        }, 1800);
        return;
      }

      voiceEngine.speak(text, emotion, () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      });
    },
    [isAudioMuted]
  );

  const handleTriggerAction = useCallback(
    (action: JarvisAction, emotion: JarvisEmotion, spokenText: string) => {
      setCurrentAction(action);
      setCurrentEmotion(emotion);
      scheduleReturnToIdle(4500);
      speakDialogue(spokenText, emotion);
    },
    [speakDialogue, scheduleReturnToIdle]
  );

  const seleccionarSubagente = useCallback(
    (id: string, color: string, nombre: string) => {
      setAgenteActivoId(id);
      setAgenteColor(color);
      setAgenteNombre(nombre);
      handleTriggerAction(
        'saludo',
        'orgullo',
        `${nombre} asumiendo el control principal en escena con color ${color}, Facu.`
      );
    },
    [handleTriggerAction]
  );

  const abrirCentroOperaciones = useCallback((seccion: SeccionCentroOperaciones) => {
    setSeccionCentroOperaciones(seccion);
    setCentroOperacionesAbierto(true);
  }, []);

  // Enviar orden o /skill al cerebro (:8091/api/ask) y desplegar la Terminal en Vivo
  const askDeeBackend = useCallback(
    async (
      promptText: string,
      preferredAction: JarvisAction = 'trabajando',
      preferredEmotion: JarvisEmotion = 'curioso'
    ) => {
      const baseUrl = voiceEngine.getBackendBaseUrl();
      setTerminalOpen(true);
      setTerminalMinimized(false);
      setCurrentAction(preferredAction);
      setCurrentEmotion(preferredEmotion);
      setActiveTaskLabel(`Tarea activa (${agenteNombre}): ${promptText}`);
      setSpeechText(`Ejecutando en vivo: "${promptText}"...`);

      try {
        const res = await fetch(`${baseUrl}/api/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptText,
            speak: false,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const reply = data.reply || 'Listo Facu.';
          const emotion: JarvisEmotion = data.emotion || preferredEmotion;
          const action: JarvisAction = data.action || preferredAction;

          if (!data.tool_result && !data.skill_id) {
            setTerminalEntries((prev) => [
              ...prev.slice(-35),
              {
                id: `ask_${Date.now()}`,
                ts: new Date().toLocaleTimeString(),
                target: 'facu',
                cmd: `dee-agent "${promptText}"`,
                stdout: reply,
                durationMs: data.latency_ms ?? data.llm?.latency_ms ?? 12,
                status: 'agent',
                agentName: data.agent_name || data.agent || agenteNombre,
              },
            ]);
          }

          handleTriggerAction(action, emotion, reply);
          return;
        }
      } catch {
        // Respaldo local abajo
      }

      handleTriggerAction(
        preferredAction,
        preferredEmotion,
        `Ejecutado en el nodo maestro facu: "${promptText}".`
      );
    },
    [agenteNombre, handleTriggerAction]
  );

  // Ejecución directa desde la Terminal Flotante en Vivo ($ comando shell o /skill)
  const handleTerminalExecCommand = useCallback(
    async (cmdOrSkill: string, targetNode: string) => {
      const trimmed = cmdOrSkill.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('/')) {
        await askDeeBackend(trimmed, 'trabajando', 'curioso');
        return;
      }

      const baseUrl = voiceEngine.getBackendBaseUrl();
      setTerminalOpen(true);
      setTerminalMinimized(false);
      setCurrentAction('trabajando');
      setCurrentEmotion('curioso');
      setActiveTaskLabel(`Shell en ${targetNode}: $ ${trimmed}`);

      try {
        const res = await fetch(`${baseUrl}/api/exec`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cmd: trimmed, target: targetNode }),
        });
        const data = await res.json();
        if (res.status === 403 || data.approval_required) {
          setCurrentAction('explicacion');
          setCurrentEmotion('combate');
          const msg =
            data.error ||
            'Sentinel requiere tu autorización por voz ("Dee, autorizá") para este comando.';
          setTerminalEntries((prev) => [
            ...prev.slice(-35),
            {
              id: `sec_${Date.now()}`,
              ts: new Date().toLocaleTimeString(),
              target: targetNode,
              cmd: trimmed,
              stderr: `🛡️ SENTINEL: ${msg}`,
              exitCode: 1,
              status: 'error',
            },
          ]);
          speakDialogue(msg, 'combate');
          return;
        }

        const ok = Boolean(data.ok);
        handleTriggerAction(
          ok ? 'celebracion_salto' : 'explicacion',
          ok ? 'orgullo' : 'combate',
          ok
            ? `Comando ejecutado en ${targetNode} en ${data.duration_ms || 0} milisegundos, Facu.`
            : `El comando en ${targetNode} devolvió código de error ${data.exit_code || 1}.`
        );
      } catch (err: any) {
        setTerminalEntries((prev) => [
          ...prev.slice(-35),
          {
            id: `err_${Date.now()}`,
            ts: new Date().toLocaleTimeString(),
            target: targetNode,
            cmd: trimmed,
            stderr: String(err?.message || 'Error de red con :8091'),
            exitCode: 1,
            status: 'error',
          },
        ]);
      }
    },
    [askDeeBackend, handleTriggerAction, speakDialogue]
  );

  // Activar/Pausar Oídos Físicos ALSA
  const handleTogglePhysicalEars = async () => {
    const baseUrl = voiceEngine.getBackendBaseUrl();
    const nextState = !earsEnabled;
    try {
      await fetch(`${baseUrl}/api/sensory/ears`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      setEarsEnabled(nextState);
      handleTriggerAction(
        nextState ? 'saludo' : 'idle',
        'curioso',
        nextState
          ? 'Oídos ALSA activados. Aplaudí dos veces o hablame cuando quieras.'
          : 'Oídos físicos en pausa, Facu.'
      );
    } catch {
      setEarsEnabled(nextState);
    }
  };

  // Activar/Pausar Ojos Multi-Cámara
  const handleTogglePhysicalEyes = async () => {
    const baseUrl = voiceEngine.getBackendBaseUrl();
    const nextState = !eyesEnabled;
    try {
      await fetch(`${baseUrl}/api/sensory/eyes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState, vigil_mode: false }),
      });
      setEyesEnabled(nextState);
      handleTriggerAction(
        nextState ? 'explicacion' : 'idle',
        nextState ? 'combate' : 'alivio',
        nextState
          ? 'Ojos multi-cámara activados con filtro PGM 30x30 y biometría facial.'
          : 'Cámaras en reposo y RAM visual limpia, Facu.'
      );
    } catch {
      setEyesEnabled(nextState);
    }
  };

  // Parada de Emergencia ("Dee, alto")
  const handleKillSwitch = async () => {
    const baseUrl = voiceEngine.getBackendBaseUrl();
    voiceEngine.stopSpeaking();
    setIsSpeaking(false);
    setCurrentAction('idle');
    setCurrentEmotion('alivio');
    setSpeechText('🛑 Parada de Emergencia activada: todos los grupos de procesos fueron detenidos al instante.');
    try {
      await fetch(`${baseUrl}/api/interrupt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Parada de Emergencia desde HUD' }),
      });
    } catch {
      // ignorar
    }
  };

  const handleToggleMic = useCallback(() => {
    if (isListening) {
      voiceEngine.stopListening();
      setIsListening(false);
    } else {
      setIsListening(true);
      setCurrentAction('saludo');
      voiceEngine.startListening(
        (transcript) => {
          setIsListening(false);
          if (transcript && transcript.trim()) {
            askDeeBackend(transcript.trim(), 'trabajando', 'curioso');
          }
        },
        undefined,
        () => {
          setIsListening(false);
        }
      );
    }
  }, [isListening, askDeeBackend]);

  const handleSubmitPrompt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptInput.trim()) return;
    const text = promptInput.trim();
    setPromptInput('');
    askDeeBackend(text, 'trabajando', 'curioso');
  };

  const cycleCameraPreset = () => {
    if (cameraPreset === 'default') setCameraPreset('closeup');
    else if (cameraPreset === 'closeup') setCameraPreset('overview');
    else setCameraPreset('default');
  };

  const visibleSkills =
    selectedSkillTier === 'all'
      ? ALL_SKILLS_AND_TOOLS
      : ALL_SKILLS_AND_TOOLS.filter((s) => s.tier === selectedSkillTier);

  const actionMeta = ACTION_LABELS[currentAction] || ACTION_LABELS.idle;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#02050b] text-slate-100 font-sans select-none flex flex-col justify-between">
      {/* 1. ESCENARIO 3D EN TIEMPO REAL (DEE + 5 SUBAGENTES CON COLORES DISTINTIVOS) */}
      <div className="absolute inset-0 z-0">
        <CyberBirdCanvas
          currentAction={currentAction}
          currentEmotion={currentEmotion}
          lipSyncData={lipSyncData}
          cameraPreset={cameraPreset}
          agentColor={agenteColor}
          showSquadFormation={mostrarEscuadron3D}
        />
      </div>

      {/* 2. CABECERA DE COMANDO SUPERIOR ESTILO GROK-BOT / META-MUSE (100% ESPAÑOL) */}
      <header className="relative z-20 flex flex-col gap-2 px-5 pt-3 pointer-events-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Izquierda: Identidad + Autor + Estado Cinemático en Tiempo Real */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#050914]/90 border border-slate-800/90 backdrop-blur-xl shadow-lg">
              <div
                className="w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-sm shadow-lg"
                style={{
                  borderColor: agenteColor,
                  backgroundColor: `${agenteColor}22`,
                  color: agenteColor,
                }}
              >
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xs font-bold tracking-wider text-slate-100 font-mono">
                    DEE-BOT-AGENTS <span style={{ color: agenteColor }}>v4.0 PEGASUS</span>
                  </h1>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      backendConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border"
                    style={{
                      borderColor: `${agenteColor}66`,
                      backgroundColor: `${agenteColor}18`,
                      color: agenteColor,
                    }}
                  >
                    {agenteNombre}
                  </span>
                  <a
                    href="https://facucercuetti.online/blog"
                    target="_blank"
                    rel="noreferrer"
                    className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700/80 text-[10px] font-mono text-cyan-300 hover:border-cyan-400 transition-colors"
                  >
                    <span>Facu Cercuetti (@NickDev24)</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  {clusterSummary} · <span className="text-emerald-400">{tokensSaved} tokens ahorrados</span>
                </p>
              </div>
            </div>

            {/* Indicador de Cinemática 3D en Vivo */}
            <div
              className={`hidden 2xl:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border backdrop-blur-xl shadow-lg transition-all ${actionMeta.badge}`}
            >
              <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
              <div>
                <div className="text-[10px] font-mono font-bold tracking-wider">
                  {actionMeta.title}
                </div>
                <div className="text-[10px] font-mono opacity-80">{actionMeta.subtitle}</div>
              </div>
            </div>
          </div>

          {/* Derecha: Sensores Físicos, Terminal Movible y Parada de Emergencia */}
          <div className="flex items-center gap-1.5 pointer-events-auto bg-[#050914]/90 backdrop-blur-xl border border-slate-800/90 p-1.5 rounded-2xl shadow-xl">
            {/* Botón de Formación Escuadrón 3D (6 Agentes Iguales con Distinto Color) */}
            <button
              onClick={() => setMostrarEscuadron3D(!mostrarEscuadron3D)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                mostrarEscuadron3D
                  ? 'bg-fuchsia-500 text-slate-950 shadow-[0_0_18px_rgba(217,70,239,0.45)]'
                  : 'bg-slate-900 text-fuchsia-300 border border-fuchsia-500/40 hover:bg-slate-800'
              }`}
              title="Desplegar / Ocultar Formación 3D Completa (Dee + 5 Subagentes con Colores Distintivos)"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{mostrarEscuadron3D ? 'Escuadrón 3D: ACTIVO' : 'Escuadrón 3D (6)'}</span>
            </button>

            {/* Botón de Terminal en Vivo Movible */}
            <button
              onClick={() => {
                if (!terminalOpen) {
                  setTerminalOpen(true);
                  setTerminalMinimized(false);
                } else {
                  setTerminalMinimized(!terminalMinimized);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                terminalOpen && !terminalMinimized
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_18px_rgba(0,240,255,0.4)]'
                  : 'bg-slate-900 text-cyan-300 border border-cyan-500/40 hover:bg-slate-800'
              }`}
              title="Desplegar / Mover Terminal Conectada en Vivo"
            >
              <TerminalIcon className="w-3.5 h-3.5" />
              <span>Terminal en Vivo ({terminalEntries.length})</span>
            </button>

            {/* Oídos Físicos ALSA */}
            <button
              onClick={handleTogglePhysicalEars}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
                earsEnabled
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-cyan-300'
              }`}
              title="Activar/Pausar Oídos Físicos ALSA (Doble Aplauso + Biometría Vocal)"
            >
              <Ear className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{earsEnabled ? 'Oídos ACTIVOS' : 'Oídos'}</span>
            </button>

            {/* Ojos Multi-Cámara */}
            <button
              onClick={handleTogglePhysicalEyes}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
                eyesEnabled
                  ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/50'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-cyan-300'
              }`}
              title="Activar/Pausar Ojos Multi-Cámara (Reconocimiento de Facu e Intrusos)"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{eyesEnabled ? 'Ojos ACTIVOS' : 'Ojos'}</span>
            </button>

            {/* Encuadre de Cámara 3D */}
            <button
              onClick={cycleCameraPreset}
              className="px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-cyan-300 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
              title="Cambiar encuadre 3D de Dee (Estándar / Primer Plano / Panorámica)"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">{ETIQUETAS_CAMARA[cameraPreset]}</span>
            </button>

            {/* Parada de Emergencia */}
            <button
              onClick={handleKillSwitch}
              className="p-1.5 rounded-xl hover:bg-rose-950/80 text-rose-400 hover:text-rose-300 transition-colors"
              title="Parada de Emergencia ('Dee, alto')"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>

            {/* Silenciar / Activar Voz */}
            <button
              onClick={() => {
                if (isSpeaking) {
                  voiceEngine.stopSpeaking();
                  setIsSpeaking(false);
                }
                setIsAudioMuted(!isAudioMuted);
              }}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
              title={isAudioMuted ? 'Activar voz' : 'Silenciar voz'}
            >
              {isAudioMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              )}
            </button>

            {/* Guía Técnica de Arquitectura */}
            <button
              onClick={() => setShowElectronGuide(true)}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
              title="Guía Técnica de Arquitectura Electron y 3D"
            >
              <Box className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Segunda Fila Superior: Barra de Módulos Reales Pegasus + Selector Rápido de Subagentes por Color */}
        <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
          {/* 8 Módulos Reales del Centro de Operaciones */}
          <div className="flex items-center gap-1.5 flex-wrap bg-[#050914]/85 border border-slate-800/90 backdrop-blur-xl px-2.5 py-1.5 rounded-2xl shadow-lg">
            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase px-1">
              Módulos Reales:
            </span>
            {[
              { id: 'escuadron' as SeccionCentroOperaciones, label: 'Escuadrón 3D', icon: <Users className="w-3 h-3" /> },
              { id: 'control_pc' as SeccionCentroOperaciones, label: 'Control PC X11', icon: <MousePointer className="w-3 h-3" /> },
              { id: 'navegador' as SeccionCentroOperaciones, label: 'Navegador CDP', icon: <Globe className="w-3 h-3" /> },
              { id: 'programas' as SeccionCentroOperaciones, label: 'Programas Linux', icon: <Cpu className="w-3 h-3" /> },
              { id: 'agenda' as SeccionCentroOperaciones, label: 'Agenda & Cron', icon: <Calendar className="w-3 h-3" /> },
              { id: 'skills_rag' as SeccionCentroOperaciones, label: 'Skills & RAG 0-RAM', icon: <Sparkles className="w-3 h-3" /> },
              { id: 'plugins_relay' as SeccionCentroOperaciones, label: 'Gateway & Relay', icon: <Puzzle className="w-3 h-3" /> },
              { id: 'proveedores_config' as SeccionCentroOperaciones, label: 'Proveedores & Ajustes', icon: <Server className="w-3 h-3" /> },
            ].map((mod) => (
              <button
                key={mod.id}
                onClick={() => abrirCentroOperaciones(mod.id)}
                className="px-2.5 py-1 rounded-xl bg-slate-900/90 hover:bg-cyan-950/80 border border-slate-700/80 hover:border-cyan-400/60 text-[11px] font-mono text-slate-200 hover:text-cyan-300 flex items-center gap-1.5 transition-all"
              >
                {mod.icon}
                <span>{mod.label}</span>
              </button>
            ))}
          </div>

          {/* Selector Rápido de Subagentes 3D Iguales con Distintos Colores */}
          <div className="flex items-center gap-1.5 bg-[#050914]/85 border border-slate-800/90 backdrop-blur-xl px-2.5 py-1.5 rounded-2xl shadow-lg">
            <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">Agente Activo:</span>
            {ESCUADRON_3D.map((ag) => {
              const activo = agenteActivoId === ag.id;
              return (
                <button
                  key={ag.id}
                  onClick={() => seleccionarSubagente(ag.id, ag.color, ag.nombre)}
                  className={`px-2 py-1 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1.5 border transition-all ${
                    activo ? 'scale-105 shadow-md' : 'opacity-75 hover:opacity-100'
                  }`}
                  style={{
                    borderColor: activo ? ag.color : `${ag.color}44`,
                    backgroundColor: activo ? `${ag.color}28` : '#0a1020',
                    color: ag.color,
                  }}
                  title={`${ag.nombre} — ${ag.rol}`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ag.color }}
                  />
                  <span className="hidden md:inline">{ag.nombre}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* 3. TERMINAL FLOTANTE EN VIVO MOVIBLE (Se despliega automáticamente con cualquier tarea) */}
      <DraggableLiveTerminal
        isOpen={terminalOpen}
        isMinimized={terminalMinimized}
        onClose={() => setTerminalOpen(false)}
        onToggleMinimize={() => setTerminalMinimized(!terminalMinimized)}
        entries={terminalEntries}
        onClear={() => setTerminalEntries([])}
        onExecuteCommand={handleTerminalExecCommand}
        activeTaskLabel={activeTaskLabel}
      />

      {/* 4. ESPACIO CENTRAL LIMPIO ENFOCADO EN EL PERSONAJE 3D */}
      <div className="flex-1 pointer-events-none" />

      {/* 5. CONSOLA INFERIOR DE COMANDO Y ARSENAL DE HABILIDADES (100% ESPAÑOL) */}
      <footer className="relative z-20 flex flex-col items-center justify-end pb-4 px-4 pointer-events-none">
        {/* Píldora de Subtítulos con Sincronización Labial */}
        <div className="w-full max-w-xl mb-2.5">
          <MuseSubtitlePill
            text={speechText}
            isSpeaking={isSpeaking}
            emotion={currentEmotion}
            onReplayVoice={() => speakDialogue(speechText, currentEmotion)}
          />
        </div>

        {/* Consola Unificada de Órdenes + Habilidades */}
        <div className="w-full max-w-4xl rounded-3xl bg-[#050914]/90 border border-slate-800/90 backdrop-blur-2xl p-3 shadow-[0_15px_60px_rgba(0,0,0,0.85)] pointer-events-auto space-y-2.5">
          <div className="flex flex-col md:flex-row items-center gap-2.5">
            {/* Orbe Acústico de Voz */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="scale-75 -my-3">
                <MuseVoiceOrb
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  lipSyncData={lipSyncData}
                  onToggleMic={handleToggleMic}
                  statusLabel=""
                />
              </div>
            </div>

            {/* Entrada de Órdenes en Español */}
            <form onSubmit={handleSubmitPrompt} className="flex-1 w-full flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/90 border border-slate-800 focus-within:border-cyan-400/70 transition-colors">
                <span className="text-cyan-400 font-mono text-xs font-bold">{'>'}</span>
                <input
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="Hablale a Dee o escribí una orden, /control-pc-x11, /rag-memoria, /cdp-mapa, /plan, /grill, /goal..."
                  className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!promptInput.trim()}
                className="px-4 py-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ejecutar</span>
              </button>
            </form>

            {/* Botones de Poses Cinemáticas en Tiempo Real */}
            <div className="flex items-center gap-1 shrink-0">
              {[
                { label: '👋', action: 'saludo' as JarvisAction, emo: 'curioso' as JarvisEmotion, msg: '¡Hola Facu! Listo para romperla.' },
                { label: '⌨️', action: 'trabajando' as JarvisAction, emo: 'curioso' as JarvisEmotion, msg: 'Desplegando teclado láser holográfico y terminal en vivo.' },
                { label: '🔮', action: 'manipular_datos' as JarvisAction, emo: 'curioso' as JarvisEmotion, msg: 'Manipulando orbe cuántico de telemetría y memoria RAG 0-RAM.' },
                { label: '⚔️', action: 'explicacion' as JarvisAction, emo: 'combate' as JarvisEmotion, msg: 'Postura de defensa Sentinel activada.' },
                { label: '🏆', action: 'celebracion_salto' as JarvisAction, emo: 'orgullo' as JarvisEmotion, msg: '¡Salto de victoria 360 grados sin errores!' },
              ].map((pose) => (
                <button
                  key={pose.action}
                  onClick={() => handleTriggerAction(pose.action, pose.emo, pose.msg)}
                  className={`px-2 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                    currentAction === pose.action
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 scale-105'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title={`Animación en tiempo real: ${pose.action}`}
                >
                  {pose.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fila Inferior: Arsenal de Habilidades Primarias, Secundarias, Terciarias y Modos */}
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                  Arsenal de Habilidades Reales (Despliega Terminal + Animación 3D):
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[
                  { id: 'all', label: `Todas (${ALL_SKILLS_AND_TOOLS.length})` },
                  { id: 'primary', label: 'Primarias' },
                  { id: 'secondary', label: 'Secundarias' },
                  { id: 'tertiary', label: 'Terciarias' },
                  { id: 'mode', label: 'Modos /plan /grill /goal' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedSkillTier(tab.id as any)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors ${
                      selectedSkillTier === tab.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {visibleSkills.map((sk) => (
                <button
                  key={sk.id}
                  onClick={() => askDeeBackend(sk.cmdPrompt, sk.action, sk.emotion)}
                  className={`px-2.5 py-1 rounded-xl border text-[11px] font-mono flex items-center gap-1.5 shrink-0 transition-all active:scale-95 ${sk.badgeColor}`}
                  title={`Ejecutar ${sk.name} en la Terminal en Vivo con animación '${sk.action}'`}
                >
                  <span>{sk.icon}</span>
                  <span className="font-semibold">{sk.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* 6. MODAL: CENTRO DE OPERACIONES REALES PEGASUS (8 Módulos 100% Reales en Español) */}
      <CentroOperacionesRealesModal
        abierto={centroOperacionesAbierto}
        seccionInicial={seccionCentroOperaciones}
        onCerrar={() => setCentroOperacionesAbierto(false)}
        baseUrl={voiceEngine.getBackendBaseUrl()}
        agenteActivoId={agenteActivoId}
        onSeleccionarAgente={seleccionarSubagente}
        mostrarEscuadron3D={mostrarEscuadron3D}
        onToggleEscuadron3D={setMostrarEscuadron3D}
        onEjecutarOrden={(orden) => {
          setCentroOperacionesAbierto(false);
          askDeeBackend(orden, 'trabajando', 'curioso');
        }}
      />

      {/* 7. MODAL: GUÍA TÉCNICA DE ARQUITECTURA */}
      {showElectronGuide && (
        <Img2ThreejsElectronGuide onClose={() => setShowElectronGuide(false)} />
      )}
    </div>
  );
}
