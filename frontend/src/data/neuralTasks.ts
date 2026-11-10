import { NeuralTaskNode } from '../types/jarvis';

export const NEURAL_TASKS: NeuralTaskNode[] = [
  {
    id: 'task_browser',
    category: 'browser',
    name: 'Atlas · Investigación & Web (Muse Smart Dispatcher)',
    badge: 'RESEARCH & WEB',
    icon: '🌐',
    status: 'ejecutando',
    details: 'Ruteando consultas con Dynamic Tool Pruning y Pool Multi-Nodo FreeLLMAPI (:3001 en facu, barto y manager1).',
    subtasks: [
      'Zero-Token Fast-Path (<1ms para telemetría y comandos directos)',
      'Pool Multi-Nodo FreeLLMAPI :3001 con circuit-breaker automático',
      'Smart Dispatcher (build | answer | discuss | security)',
      'Modos especiales: /plan, /grill (auditoría adversarial) y /goal',
      'Fallback automático a Cloudflare Workers AI (Llama-3.3-70B)',
    ],
    metrics: {
      cpu: '1.8%',
      ram: '64MB',
      throughput: '<1ms Fast-Path',
    },
    color: '#00f0ff',
    previewUrl: 'http://127.0.0.1:8091/api/status',
  },
  {
    id: 'task_terminal',
    category: 'terminal',
    name: 'Cluster Workbench · facu + barto + manager1',
    badge: 'CLUSTER 3 NODOS',
    icon: '💻',
    status: 'ejecutando',
    details: 'Orquestando ejecución distribuida con RouteEnvelope (hop < 4), Bench (:8731), Gateway (:8730) y Hermes (:8642).',
    subtasks: [
      'facu (Maestro 127.0.0.1): Core :8091 + Gateway :8730 + Bench :8731',
      'barto (Worker 192.168.100.28): Hermes :8642 + FreeLLMAPI :3001',
      'manager1 (Worker 192.168.100.39): Hermes :8642 + Mic/Cam Failover',
      'Aislamiento por Process Group (os.killpg) y buffer Tail(cap)',
      'Autonomía 100% garantizada en facu si los workers están offline',
    ],
    metrics: {
      cpu: '4.2%',
      ram: '92MB',
      throughput: '3 Nodos LAN',
    },
    color: '#38bdf8',
    codeSnippet: `$ dee status
  • facu (master): ONLINE · CPU 8.4% · RAM 6.8/11.0 GB
  • FreeLLMAPI pool: 3 endpoints configurados (:3001)
  • RouteEnvelope anti-loop guard: hop < 4 [OK]
  • Process Group Workbench (:8731): READY`,
  },
  {
    id: 'task_editor',
    category: 'editor',
    name: 'Hephaestus & Grill-Master · Código & Verificación',
    badge: 'BUILD & /GOAL',
    icon: '📝',
    status: 'analizando',
    details: 'Construyendo, auditando con /grill y auto-verificando con el bucle autónomo /goal hasta pasar tests.',
    subtasks: [
      'Hephaestus: generación y refactorización atómica de código',
      'Grill-Master (/grill): auditoría adversarial de bugs y cuellos de botella',
      'Goal Loop (/goal): ejecución + test + auto-reparación iterativa',
      'Gateway de Archivos (:8730): escritura atómica .tmp -> os.replace',
    ],
    metrics: {
      cpu: '2.1%',
      ram: '48MB',
      throughput: '0 warnings',
    },
    color: '#a855f7',
    codeSnippet: `// Bucle Autónomo /goal en DeeEngine
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const plan = await llmPool.chat(goalMessages);
  const check = await cluster.executeCommand(verifyCmd, 'facu');
  if (check.returncode === 0) return crystallizeSkill(plan);
}`,
  },
  {
    id: 'task_database',
    category: 'database',
    name: 'Mnemosyne · Memoria Markdown & Skill Crystallizer',
    badge: '0 MB RAM DB',
    icon: '🗄️',
    status: 'ejecutando',
    details: 'Memoria episódica persistente en Markdown (data/memory/*.md) y cristalización automática de herramientas con 0 MB de RAM en reposo.',
    subtasks: [
      'Episodic Memory: profile_facu.md, projects.md, episode_log.md',
      'Búsqueda léxica ponderada en < 2 ms sin vector DB pesada',
      'Skill Crystallizer: guarda flujos exitosos en data/skills/*.json',
      'Routines Engine: cron jobs + webhooks + grabador de acciones',
    ],
    metrics: {
      cpu: '0.3%',
      ram: '0MB Idle',
      throughput: '0.8ms lookup',
    },
    color: '#4ade80',
  },
  {
    id: 'task_communication',
    category: 'communication',
    name: 'Oídos & Voz · ALSA + Biometría Vocal + Lip-Sync',
    badge: 'SENSORY AUDIO',
    icon: '🎙️',
    status: 'ejecutando',
    details: 'Escucha continua ALSA con detector de doble aplauso, VAD adaptativo, biometría vocal de Facu y voz argentina con Lip-Sync.',
    subtasks: [
      'Oídos (ears.py): Doble aplauso + VAD adaptativo + Barge-in',
      'Speaker ID (speaker_id.py): huella acústica 12-D de la voz de Facu',
      'Voz (voice.py): edge-tts (es-AR-TomasNeural) -> Piper ONNX local',
      'Lip-Sync 30 FPS: extracción de energía RMS y visemas reales del WAV',
    ],
    metrics: {
      cpu: '1.5%',
      ram: '28MB',
      throughput: '16kHz PCM',
    },
    color: '#fbbf24',
    chatSnippet: [
      { sender: 'Facu (Voz Verificada 94%)', text: 'Che Dee, ¿cómo están las máquinas del laboratorio?', time: 'Vivo' },
      { sender: 'Dee (es-AR-TomasNeural)', text: '¡De diez Facu! El nodo maestro está fresquito, Oídos y Ojos activos y el pool FreeLLMAPI listo en el puerto 3001.', time: 'Vivo' },
    ],
  },
  {
    id: 'task_files',
    category: 'files',
    name: 'Ojos & Sentinel · Visión Multi-Cámara & Seguridad',
    badge: 'VISION & GUARD',
    icon: '👁️',
    status: 'completado',
    details: 'Vigilancia multi-cámara (carecam + manager1 + barto) con filtro PGM 9x8/30x30, reconocimiento de Facu/Intrusos y Sentinel.',
    subtasks: [
      'Filtro PGM de 2 etapas (9x8 dHash + 30x30 diff) antes de llamar a IA',
      'Biometría Facial: bienvenida a Facu + Escudo de Invitados + Alerta Intruso',
      'Evidencia forense automática en data/media/conservar/intrusos/',
      'Sentinel Supervisor: ALLOW / ASK_FACU / DENY_ALWAYS + Kill-Switch',
    ],
    metrics: {
      cpu: '0.9%',
      ram: '35MB',
      throughput: '<15ms PGM diff',
    },
    color: '#f43f5e',
  },
];
