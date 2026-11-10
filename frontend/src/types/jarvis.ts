export type JarvisEmotion = 
  | 'orgullo'        // Star eyes ⭐⭐ (Green/Cyan)
  | 'curioso'        // Wide circle/diamond eyes (Cyan)
  | 'combate'        // Fierce angled sharp glare (Neon Magenta)
  | 'melancolia'     // XX eyes with tears (Magenta/Cyan)
  | 'desden'         // Half-closed critical squint (Magenta)
  | 'alivio'         // Soft gentle downward curved eyes (Teal)
  | 'neutro';        // Sleek horizontal cyber slit (Cyan)

export type JarvisAction = 
  | 'idle'               // En cabina con respiración y seguimiento de cursor
  | 'celebracion_salto'  // ¡Salto de victoria! Puño en alto y partículas
  | 'saludo'             // Saludo con palma abierta a Facu
  | 'despedida'          // Despedida y modo reposo suave
  | 'trabajando'         // Modo desarrollo técnico con consolas holográficas
  | 'manipular_datos'    // Manipulación táctil de datos y cubo holográfico
  | 'explicacion';       // Gesto dinámico conversacional inclinado hacia adelante

export type NavView = 
  | 'sala_principal'
  | 'hermes_agent'        // Nous Research Hermes autonomous loop & tools
  | 'rakazo_memory'        // Rakazo persistent memory & routines
  | 'opengrok_team'        // OpenGrokBot multi-agent team matrix
  | 'laboratorio_3d'       // Sandbox de expresiones y poses
  | 'herramientas'         // Suite img2threejs & Electron
  | 'configuracion';       // Configuración & BYOM

export interface AgentTeammate {
  id: string;
  name: string;
  role: string;
  sourceRepo: 'OpenGrokBot' | 'Rakazo' | 'Hermes-Agent';
  status: 'Activo' | 'Pensando' | 'Ejecutando' | 'Standby';
  avatarColor: string;
  description: string;
  currentTask?: string;
}

export interface HermesThoughtStep {
  id: string;
  timestamp: string;
  agent: string;
  type: 'think' | 'tool_call' | 'tool_result' | 'reflection' | 'answer';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  durationMs?: number;
}

export interface RakazoMemoryItem {
  id: string;
  category: 'preferencia' | 'conocimiento' | 'proyecto' | 'rutina';
  title: string;
  content: string;
  timestamp: string;
  confidence: number;
}

export interface AIProvider {
  id: string;
  name: string;
  model: string;
  status: 'Activo' | 'Standby' | 'Offline';
  latency: string;
  icon: string;
  color: string;
  type: 'Local' | 'Cloud';
}

export interface SystemMetrics {
  nodesActive: number;
  totalNodes: number;
  activeTasks: number;
  memoryUsage: number;
  uptime: string;
  isOnline: boolean;
  tokensPerSec: number;
  agentLoopLatencyMs: number;
}

export interface VoiceLipSyncData {
  volume: number;
  frequency: number;
  viseme: 'neutral' | 'open_a' | 'round_o' | 'wide_e';
}

export type NeuralTaskCategory = 
  | 'browser'        // Navegación web autónoma / Redes sociales / Leads
  | 'terminal'       // Ejecución de comandos / Shell sandboxed / Docker
  | 'editor'         // Edición de código / AST / Refactoring
  | 'database'       // Base de datos / Rakazo vector store / Consultas
  | 'communication'  // Mensajería / Clientes / Negociaciones
  | 'files';         // Gestión de archivos / Organización de carpetas

export interface NeuralTaskNode {
  id: string;
  category: NeuralTaskCategory;
  name: string;
  badge: string;
  icon: string;
  status: 'ejecutando' | 'completado' | 'esperando' | 'analizando';
  details: string;
  subtasks: string[];
  metrics: {
    cpu: string;
    ram: string;
    throughput: string;
  };
  color: string;
  codeSnippet?: string;
  previewUrl?: string;
  chatSnippet?: { sender: string; text: string; time: string }[];
}
