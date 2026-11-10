import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CyberBirdCanvas } from './components/CyberBirdCanvas';
import { MuseVoiceOrb } from './components/MuseVoiceOrb';
import { MuseSubtitlePill } from './components/MuseSubtitlePill';
import { WorkstationsSpatialDrawer } from './components/WorkstationsSpatialDrawer';
import { LiveTaskInspectorModal } from './components/views/LiveTaskInspectorModal';
import { Img2ThreejsElectronGuide } from './components/views/Img2ThreejsElectronGuide';
import { voiceEngine, BackendTTSChunk } from './services/voiceEngine';
import { NEURAL_TASKS } from './data/neuralTasks';
import {
  JarvisAction,
  JarvisEmotion,
  VoiceLipSyncData,
  NeuralTaskNode,
} from './types/jarvis';
import {
  Camera,
  Monitor,
  Box,
  Keyboard as KeyboardIcon,
  Send,
  X,
  Volume2,
  VolumeX,
  Ear,
  Eye,
  ShieldAlert,
} from 'lucide-react';

export default function App() {
  // Navigation & Spatial Modals
  const [showWorkstationsDrawer, setShowWorkstationsDrawer] = useState(false);
  const [showElectronGuide, setShowElectronGuide] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showTypeInput, setShowTypeInput] = useState(false);

  // Mascot Kinematics, Emotion & Camera
  const [currentAction, setCurrentAction] = useState<JarvisAction>('idle');
  const [currentEmotion, setCurrentEmotion] = useState<JarvisEmotion>('curioso');
  const [cameraPreset, setCameraPreset] = useState<'default' | 'closeup' | 'overview'>('default');

  // 3D Laboratory Workstations Customization
  const [nodeScale, setNodeScale] = useState(1.0);
  const [orbitRadius, setOrbitRadius] = useState(2.4);
  const [orbitPaused, setOrbitPaused] = useState(false);
  const [orbitAngle, setOrbitAngle] = useState(0);

  // Live Backend State
  const [backendConnected, setBackendConnected] = useState(false);
  const [earsEnabled, setEarsEnabled] = useState(false);
  const [eyesEnabled, setEyesEnabled] = useState(false);
  const [clusterSummary, setClusterSummary] = useState('facu (Maestro) · Pool :3001 · 3 Nodos');
  const [tasks, setTasks] = useState<NeuralTaskNode[]>(NEURAL_TASKS);

  // Audio / Sound state
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Dialogue & Lip-Sync State
  const [speechText, setSpeechText] = useState(
    '¡Che Facu! Dee v4.0 Supreme en línea. Oídos ALSA con doble aplauso, Ojos multi-cámara con biometría y el clúster listo. ¿Qué rompemos hoy?'
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [lipSyncData, setLipSyncData] = useState<VoiceLipSyncData>({
    volume: 0,
    frequency: 0,
    viseme: 'neutral',
  });

  const textInputRef = useRef<HTMLInputElement>(null);
  const ttsQueueRef = useRef<BackendTTSChunk[]>([]);
  const isPlayingQueueRef = useRef(false);

  // Register real-time lip-sync callback
  useEffect(() => {
    voiceEngine.setLipSyncCallback((data) => {
      setLipSyncData(data);
    });
  }, []);

  // Process incoming backend TTS chunks sequentially
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
      }, 1500);
      return;
    }

    voiceEngine.playBackendChunk(next, () => {
      isPlayingQueueRef.current = false;
      processTtsQueue();
    });
  }, [isAudioMuted]);

  // Connect to Dee Core Backend SSE (/events) & Poll Status (/api/status)
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

        const nodes = data?.cluster?.nodes || {};
        const onlineCount = Object.values(nodes).filter((n: any) => n?.online).length;
        const facuCpu = nodes?.facu?.telemetry?.cpu_pct ?? 0;
        const facuRam = nodes?.facu?.telemetry?.ram_used_gb ?? 0;
        setClusterSummary(
          `Nodos Online: ${onlineCount}/3 · CPU facu: ${facuCpu}% · RAM: ${facuRam}GB`
        );

        // Enrich 3D workstations with live backend data
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id === 'task_terminal') {
              return {
                ...t,
                metrics: {
                  cpu: `${facuCpu}%`,
                  ram: `${facuRam} GB`,
                  throughput: `${onlineCount}/3 Nodos Online`,
                },
              };
            }
            if (t.id === 'task_communication') {
              return {
                ...t,
                status: data?.sensory?.ears?.running ? 'ejecutando' : 'analizando',
                metrics: {
                  cpu: data?.sensory?.ears?.running ? '1.4%' : '0.1%',
                  ram: `Ruido: ${Math.round(data?.sensory?.ears?.noise_floor_rms || 380)} RMS`,
                  throughput: data?.sensory?.speaker_biometrics?.enrolled
                    ? 'Voz Facu OK'
                    : 'Modo Abierto',
                },
              };
            }
            if (t.id === 'task_files') {
              return {
                ...t,
                status: data?.sensory?.eyes?.running ? 'ejecutando' : 'completado',
                metrics: {
                  cpu: data?.sensory?.eyes?.running ? '0.9%' : '0.1%',
                  ram: `Intrusos: ${data?.sensory?.eyes?.biometrics?.intruder_alerts || 0}`,
                  throughput: `Presencia: ${data?.sensory?.eyes?.last_presence || 'idle'}`,
                },
              };
            }
            return t;
          })
        );
      } catch {
        setBackendConnected(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);

    try {
      es = new EventSource(`${baseUrl}/events`);
      es.onopen = () => setBackendConnected(true);
      es.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const { type, payload } = msg;
          if (type === 'character_state' && payload) {
            if (payload.action) setCurrentAction(payload.action);
            if (payload.emotion) setCurrentEmotion(payload.emotion);
            if (typeof payload.is_listening === 'boolean') setIsListening(payload.is_listening);
          } else if (type === 'tts_chunk' && payload?.text) {
            ttsQueueRef.current.push(payload);
            processTtsQueue();
          } else if (type === 'double_clap') {
            setCurrentAction('saludo');
            setCurrentEmotion('curioso');
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
          // Ignore malformed event
        }
      };
    } catch {
      // Fallback if SSE unavailable
    }

    return () => {
      clearInterval(interval);
      if (es) es.close();
    };
  }, [processTtsQueue]);

  // Synthesize speech and lip-sync locally or via backend
  const speakDialogue = useCallback(
    (text: string, emotion: JarvisEmotion = 'curioso', onEnd?: () => void) => {
      setSpeechText(text);
      setIsSpeaking(true);
      setCurrentEmotion(emotion);

      if (isAudioMuted) {
        setTimeout(() => {
          setIsSpeaking(false);
          if (onEnd) onEnd();
        }, 2000);
        return;
      }

      voiceEngine.speak(text, emotion, () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      });
    },
    [isAudioMuted]
  );

  // Trigger Action with associated Emotion and Spoken response
  const handleTriggerAction = useCallback(
    (action: JarvisAction, emotion: JarvisEmotion, spokenText: string) => {
      setCurrentAction(action);
      setCurrentEmotion(emotion);

      speakDialogue(spokenText, emotion, () => {
        if (action !== 'idle') {
          setTimeout(() => {
            setCurrentAction('idle');
          }, 1800);
        }
      });
    },
    [speakDialogue]
  );

  // Send query to Dee Core Brain (/api/ask)
  const askDeeBackend = useCallback(
    async (promptText: string) => {
      const baseUrl = voiceEngine.getBackendBaseUrl();
      setCurrentAction('trabajando');
      setCurrentEmotion('curioso');
      setSpeechText(`Procesando: "${promptText}"...`);

      try {
        const res = await fetch(`${baseUrl}/api/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptText,
            speak: false, // We play the returned / SSE tts_chunk in the browser with lip-sync
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const reply = data.reply || 'Listo Facu.';
          const emotion: JarvisEmotion = data.emotion || 'curioso';
          const action: JarvisAction = data.action || 'explicacion';
          handleTriggerAction(action, emotion, reply);
          return;
        }
      } catch {
        // Offline fallback below
      }

      handleTriggerAction(
        'explicacion',
        'curioso',
        `De diez Facu. Ejecutando "${promptText}" en el laboratorio local.`
      );
    },
    [handleTriggerAction]
  );

  // Open 3D Workstation Task Inspector
  const handleSelectTask = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId);
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        speakDialogue(
          `Che Facu, abriendo el módulo ${task.name}. Acá tenés las métricas en vivo.`,
          'curioso'
        );
      }
    },
    [speakDialogue, tasks]
  );

  // Toggle physical ALSA ears on facu
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
      speakDialogue(
        nextState
          ? 'Oídos ALSA activados. Aplaudí dos veces o hablame cuando quieras.'
          : 'Oídos físicos en pausa, Facu.',
        'curioso'
      );
    } catch {
      setEarsEnabled(nextState);
    }
  };

  // Toggle physical multi-camera eyes on facu/manager1/barto
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
      speakDialogue(
        nextState
          ? 'Ojos multi-cámara activados con filtro de movimiento PGM y biometría.'
          : 'Cámaras en reposo, Facu.',
        'curioso'
      );
    } catch {
      setEyesEnabled(nextState);
    }
  };

  // Emergency Kill-Switch ("Dee, alto")
  const handleKillSwitch = async () => {
    const baseUrl = voiceEngine.getBackendBaseUrl();
    voiceEngine.stopSpeaking();
    setIsSpeaking(false);
    setCurrentAction('idle');
    setCurrentEmotion('alivio');
    setSpeechText('🛑 Kill-Switch activado: todas las tareas y procesos fueron detenidos.');
    try {
      await fetch(`${baseUrl}/api/interrupt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Botón de parada en HUD 3D' }),
      });
    } catch {
      // ignore
    }
  };

  // Voice toggle (Browser mic + Backend brain)
  const handleToggleMic = useCallback(() => {
    if (isListening) {
      voiceEngine.stopListening();
      setIsListening(false);
    } else {
      setIsListening(true);
      voiceEngine.startListening(
        (transcript) => {
          setIsListening(false);
          if (transcript && transcript.trim()) {
            askDeeBackend(transcript.trim());
          }
        },
        undefined,
        () => {
          setIsListening(false);
        }
      );
    }
  }, [isListening, askDeeBackend]);

  // Keyboard shortcut: [SPACE] to toggle voice mic, [ESC] to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        handleToggleMic();
      } else if (e.code === 'Escape') {
        setShowWorkstationsDrawer(false);
        setShowElectronGuide(false);
        setSelectedTaskId(null);
        setShowTypeInput(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleMic]);

  // Submit Text Input Prompt
  const handleSubmitPrompt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptInput.trim()) return;

    const text = promptInput.trim();
    setPromptInput('');
    setShowTypeInput(false);
    askDeeBackend(text);
  };

  // Camera preset cycling
  const cycleCameraPreset = () => {
    if (cameraPreset === 'default') setCameraPreset('closeup');
    else if (cameraPreset === 'closeup') setCameraPreset('overview');
    else setCameraPreset('default');
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#02050b] text-slate-100 font-sans select-none flex flex-col justify-between">
      {/* 1. THREE.JS 3D SPATIAL HERO: DEE IN HIS ADVANCED CYBER LABORATORY */}
      <div className="absolute inset-0 z-0">
        <CyberBirdCanvas
          currentAction={currentAction}
          currentEmotion={currentEmotion}
          lipSyncData={lipSyncData}
          cameraPreset={cameraPreset}
          onSelectTask={handleSelectTask}
          nodeScale={nodeScale}
          orbitRadius={orbitRadius}
          orbitPaused={orbitPaused}
          orbitAngleOffset={orbitAngle}
        />
      </div>

      {/* 2. MINIMALIST TOP STATUS & SPATIAL CAPSULE */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 pointer-events-none">
        {/* Left: Minimal Glass Badge */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div className="w-8 h-8 rounded-xl bg-slate-950/80 border border-cyan-400/50 backdrop-blur-md shadow-[0_0_15px_rgba(0,240,255,0.3)] flex items-center justify-center font-bold text-cyan-300 text-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold tracking-widest text-cyan-300 font-mono">
                DEE-BOT-AGENTS // v4.0 SUPREME
              </h1>
              <span
                className={`w-2 h-2 rounded-full ${
                  backendConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              />
            </div>
            <p className="text-[10px] text-slate-400 font-mono">{clusterSummary}</p>
          </div>
        </div>

        {/* Right: Discreet Glass Controls Capsule */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-slate-950/75 backdrop-blur-xl border border-slate-800/80 p-1 rounded-2xl shadow-xl">
          {/* Physical ALSA Ears Toggle */}
          <button
            onClick={handleTogglePhysicalEars}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
              earsEnabled
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                : 'hover:bg-slate-800 text-slate-400 hover:text-cyan-300'
            }`}
            title="Activar/Pausar Oídos Físicos ALSA (Doble Aplauso + Biometría Vocal)"
          >
            <Ear className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{earsEnabled ? 'Oídos ON' : 'Oídos'}</span>
          </button>

          {/* Physical Multi-Camera Eyes Toggle */}
          <button
            onClick={handleTogglePhysicalEyes}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
              eyesEnabled
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40'
                : 'hover:bg-slate-800 text-slate-400 hover:text-cyan-300'
            }`}
            title="Activar/Pausar Ojos Multi-Cámara (Reconocimiento de Facu e Intrusos)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{eyesEnabled ? 'Ojos ON' : 'Ojos'}</span>
          </button>

          {/* Camera View Toggle */}
          <button
            onClick={cycleCameraPreset}
            className="px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-cyan-300 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
            title="Cambiar ángulo de cámara 3D (Cine / Primer Plano / Laboratorio)"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline capitalize">{cameraPreset}</span>
          </button>

          {/* 3D Workstations Drawer Button */}
          <button
            onClick={() => setShowWorkstationsDrawer(true)}
            className="px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-cyan-300 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
            title="Abrir panel de calibración de computadoras 3D"
          >
            <Monitor className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Nodos (6)</span>
          </button>

          {/* Kill-Switch Button */}
          <button
            onClick={handleKillSwitch}
            className="p-1.5 rounded-xl hover:bg-rose-950/80 text-rose-400 hover:text-rose-300 transition-colors"
            title="Kill-Switch de Emergencia ('Dee, alto')"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>

          {/* Mute/Sound Toggle */}
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

          {/* Architecture & Electron Guide */}
          <button
            onClick={() => setShowElectronGuide(true)}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
            title="Guía técnica de Arquitectura"
          >
            <Box className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </header>

      {/* 3. CENTER VIEWPORT: UNCLUTTERED 3D STAGE */}
      <div className="flex-1 pointer-events-none" />

      {/* 4. BOTTOM VOICE-FIRST INTERFACE */}
      <footer className="relative z-20 flex flex-col items-center justify-end pb-7 px-4 pointer-events-none">
        {/* Floating Subtitle Pill */}
        <div className="w-full max-w-lg mb-4">
          <MuseSubtitlePill
            text={speechText}
            isSpeaking={isSpeaking}
            emotion={currentEmotion}
            onReplayVoice={() => speakDialogue(speechText, currentEmotion)}
          />
        </div>

        {/* Central Voice Acoustic Orb */}
        <div className="relative flex items-center justify-center">
          <MuseVoiceOrb
            isListening={isListening}
            isSpeaking={isSpeaking}
            lipSyncData={lipSyncData}
            onToggleMic={handleToggleMic}
            statusLabel="Aplaudí 2 veces, tocá el orbe o presioná [ESPACIO] para hablar con Dee"
          />

          {/* Discreet text input toggle button */}
          <button
            onClick={() => {
              setShowTypeInput(!showTypeInput);
              if (!showTypeInput) {
                setTimeout(() => textInputRef.current?.focus(), 100);
              }
            }}
            className="absolute right-0 sm:-right-12 top-6 p-2 rounded-full bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-300 transition-all pointer-events-auto shadow-md"
            title="Escribir por teclado (/plan, /grill, /goal...)"
          >
            <KeyboardIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Optional Text Input */}
        {showTypeInput && (
          <div className="w-full max-w-md mt-3 pointer-events-auto animate-in fade-in slide-in-from-bottom-2">
            <form
              onSubmit={handleSubmitPrompt}
              className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/90 border border-cyan-500/50 backdrop-blur-xl shadow-2xl"
            >
              <input
                ref={textInputRef}
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Orden para Dee (ej: estado, /plan, /grill, /goal)..."
                className="flex-1 bg-transparent px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none"
              />
              <button
                type="submit"
                disabled={!promptInput.trim()}
                className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-30 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowTypeInput(false)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Discreet Micro-Action Gesture & Command Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 pointer-events-auto">
          <button
            onClick={() => askDeeBackend('estado del cluster')}
            className="px-2.5 py-1 rounded-full bg-slate-950/60 hover:bg-emerald-950/80 border border-slate-800 hover:border-emerald-400/80 text-[11px] font-mono text-slate-400 hover:text-emerald-300 transition-all active:scale-95 flex items-center gap-1 shadow-sm backdrop-blur-md"
            title="Consultar telemetría instantánea (Zero-Token Fast-Path)"
          >
            <span>⚡</span>
            <span className="hidden sm:inline">Estado Clúster</span>
          </button>

          <button
            onClick={() =>
              handleTriggerAction(
                'celebracion_salto',
                'orgullo',
                '¡Toma ya, Facu! ¡Mirá qué joyita te armé! Compilado al toque y con cero warnings.'
              )
            }
            className="px-2.5 py-1 rounded-full bg-slate-950/60 hover:bg-cyan-950/80 border border-slate-800 hover:border-cyan-400/80 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-all active:scale-95 flex items-center gap-1 shadow-sm backdrop-blur-md"
            title="Saltar de alegría"
          >
            <span>⭐</span>
            <span className="hidden sm:inline">Celebrar</span>
          </button>

          <button
            onClick={() =>
              handleTriggerAction(
                'saludo',
                'curioso',
                '¡Che Facu! Dee en línea. Cero latencia, las plumas de titanio aceitadas y las 6 estaciones del laboratorio laburando a cuatro manos.'
              )
            }
            className="px-2.5 py-1 rounded-full bg-slate-950/60 hover:bg-sky-950/80 border border-slate-800 hover:border-sky-400/80 text-[11px] font-mono text-slate-400 hover:text-sky-300 transition-all active:scale-95 flex items-center gap-1 shadow-sm backdrop-blur-md"
            title="Saludar a Facu"
          >
            <span>👋</span>
            <span className="hidden sm:inline">Saludar</span>
          </button>

          <button
            onClick={() =>
              handleTriggerAction(
                'manipular_datos',
                'curioso',
                'Sincronizando memoria Markdown y Skills cristalizadas con cero megabytes de consumo en RAM.'
              )
            }
            className="px-2.5 py-1 rounded-full bg-slate-950/60 hover:bg-purple-950/80 border border-slate-800 hover:border-purple-400/80 text-[11px] font-mono text-slate-400 hover:text-purple-300 transition-all active:scale-95 flex items-center gap-1 shadow-sm backdrop-blur-md"
            title="Memoria & Skills"
          >
            <span>📊</span>
            <span className="hidden sm:inline">Memoria</span>
          </button>

          <button
            onClick={() =>
              handleTriggerAction(
                'explicacion',
                'combate',
                '¡Ojo al piojo! Ceño fruncido en ángulo de combate, Sentinel activo y cámaras vigilando.'
              )
            }
            className="px-2.5 py-1 rounded-full bg-slate-950/60 hover:bg-rose-950/80 border border-slate-800 hover:border-rose-400/80 text-[11px] font-mono text-slate-400 hover:text-rose-300 transition-all active:scale-95 flex items-center gap-1 shadow-sm backdrop-blur-md"
            title="Modo Guardia Sentinel"
          >
            <span>⚔️</span>
            <span className="hidden sm:inline">Guardia</span>
          </button>

          <button
            onClick={() =>
              handleTriggerAction(
                'despedida',
                'alivio',
                'Entrando en modo reposo a 8 FPS para cuidar el procesador de facu. Dejo los oídos atentos al doble aplauso.'
              )
            }
            className="px-2.5 py-1 rounded-full bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-400 hover:text-white transition-all active:scale-95 flex items-center gap-1 shadow-sm backdrop-blur-md"
            title="Hibernar / Reposo"
          >
            <span>💤</span>
            <span className="hidden sm:inline">Reposo</span>
          </button>
        </div>
      </footer>

      {/* 5. MODAL: LIVE WORKSTATION INSPECTOR */}
      {selectedTask && (
        <LiveTaskInspectorModal
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onSpeakStatus={(msg) => speakDialogue(msg, 'curioso')}
        />
      )}

      {/* 6. SPATIAL DRAWER: 3D WORKSTATION CALIBRATION & TASKS */}
      <WorkstationsSpatialDrawer
        isOpen={showWorkstationsDrawer}
        onClose={() => setShowWorkstationsDrawer(false)}
        nodeScale={nodeScale}
        setNodeScale={setNodeScale}
        orbitRadius={orbitRadius}
        setOrbitRadius={setOrbitRadius}
        orbitAngle={orbitAngle}
        setOrbitAngle={setOrbitAngle}
        orbitPaused={orbitPaused}
        setOrbitPaused={setOrbitPaused}
        onSelectTask={handleSelectTask}
      />

      {/* 7. MODAL: ARCHITECTURE & ELECTRON GUIDE */}
      {showElectronGuide && (
        <Img2ThreejsElectronGuide onClose={() => setShowElectronGuide(false)} />
      )}
    </div>
  );
}
