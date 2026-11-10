import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Zap, 
  Hand, 
  Code, 
  Layers, 
  LogOut, 
  Volume2, 
  Camera, 
  Sliders, 
  Image as ImageIcon 
} from 'lucide-react';
import { JarvisAction, JarvisEmotion, VoiceLipSyncData } from '../../types/jarvis';

interface Lab3DViewProps {
  onClose: () => void;
  currentAction: JarvisAction;
  currentEmotion: JarvisEmotion;
  onSelectAction: (action: JarvisAction, emotion: JarvisEmotion, spokenText: string) => void;
  onSelectEmotion: (emotion: JarvisEmotion) => void;
  cameraPreset: 'default' | 'closeup' | 'overview' | 'fullbody';
  setCameraPreset: (preset: 'default' | 'closeup' | 'overview' | 'fullbody') => void;
  lipSyncData: VoiceLipSyncData;
  onTestPhrase: (phrase: string, emotion: JarvisEmotion) => void;
}

export const Lab3DView: React.FC<Lab3DViewProps> = ({
  onClose,
  currentAction,
  currentEmotion,
  onSelectAction,
  onSelectEmotion,
  cameraPreset,
  setCameraPreset,
  lipSyncData,
  onTestPhrase,
}) => {
  const [activeTab, setActiveTab] = useState<'poses' | 'expressions' | 'lipsync' | 'references'>('poses');

  const emotionsList: { id: JarvisEmotion; label: string; desc: string; icon: string; color: string }[] = [
    { id: 'orgullo', label: 'Orgullo / Satisfacción', desc: 'Ojos de estrella ⭐⭐ con brillo verde esmeralda y cyan. Celebración de hito.', icon: '⭐', color: 'border-emerald-500/50 text-emerald-300' },
    { id: 'curioso', label: 'Curiosidad Genuina', desc: 'Ojos circulares amplios ◉◉ de escaneo de datos e interés genuino.', icon: '◉', color: 'border-cyan-500/50 text-cyan-300' },
    { id: 'combate', label: 'Determinación de Combate', desc: 'Mirada afilada e inclinada feroz en magenta intenso para ciber-defensa.', icon: '⚔️', color: 'border-fuchsia-500/50 text-fuchsia-300' },
    { id: 'melancolia', label: 'Nostalgia / Melancolía', desc: 'Ojos en cruz ✖✖ con trazo luminoso de lágrimas en cyan.', icon: '✖', color: 'border-pink-500/50 text-pink-300' },
    { id: 'desden', label: 'Desdén Sutil / Ojo Crítico', desc: 'Entrecejo semicerrado ━ para revisión analítica de código.', icon: '━', color: 'border-rose-500/50 text-rose-300' },
    { id: 'alivio', label: 'Alivio Profundo', desc: 'Curvatura suave descendente ◠◠ tras resolver un error crítico.', icon: '◠', color: 'border-teal-500/50 text-teal-300' },
    { id: 'neutro', label: 'Neutro / Sleek Slit', desc: 'Visor horizontal cibernético estándar en reposo.', icon: '▬', color: 'border-sky-500/50 text-sky-300' },
  ];

  const actionsList: { id: JarvisAction; label: string; emotion: JarvisEmotion; phrase: string; desc: string; icon: any }[] = [
    { 
      id: 'celebracion_salto', 
      label: '¡Saltar de Alegría! (Victoria)', 
      emotion: 'orgullo', 
      phrase: '¡Sí Facu! ¡Objetivo completado con éxito absoluto!', 
      desc: 'Salto parabólico en el aire con puño en alto ("4F" visible), ojos de estrella y partículas de victoria.',
      icon: Zap
    },
    { 
      id: 'saludo', 
      label: 'Gesto Saludo Abierto', 
      emotion: 'curioso', 
      phrase: '¡Hola Facu! Bienvenido a la sala de control.', 
      desc: 'Brazo derecho extendido con palma abierta y LED de bienvenida, inclinación cálida de cabeza.',
      icon: Hand
    },
    { 
      id: 'trabajando', 
      label: 'Punto de Vista Técnico (Trabajar)', 
      emotion: 'curioso', 
      phrase: 'Entrando en modo desarrollo. Compilando núcleos y telemetría.', 
      desc: 'Despliega 3 pantallas holográficas flotantes con código y animación de tecleo a dos manos.',
      icon: Code
    },
    { 
      id: 'manipular_datos', 
      label: 'Manipulación de Datos Complejos', 
      emotion: 'curioso', 
      phrase: 'Rotando matriz cuántica y proyectando flujos en 3D.', 
      desc: 'Genera un cubo de datos y anillos orbitales flotando y girando entre las manos del avatar.',
      icon: Layers
    },
    { 
      id: 'explicacion', 
      label: 'Explicación Detallada', 
      emotion: 'curioso', 
      phrase: 'Te explico la arquitectura: integramos img2threejs para generar el modelo y Electron para la app de escritorio.', 
      desc: 'Inclinación dinámica hacia adelante con gesticulación conversacional alternada.',
      icon: Sparkles
    },
    { 
      id: 'despedida', 
      label: 'Despedirse / Modo Reposo', 
      emotion: 'alivio', 
      phrase: 'Hasta luego, Facu. Pasando a vigilancia pasiva. Cuídate.', 
      desc: 'Onda suave de despedida, retorno fluido al asiento y atenuación de luces.',
      icon: LogOut
    },
  ];

  const testPhrases = [
    { text: '¡Hola Facu! ¿Qué desafío programamos hoy?', emotion: 'curioso' as JarvisEmotion },
    { text: '¡Excelente Facu! ¡Superamos todos los benchmarks sin errores!', emotion: 'orgullo' as JarvisEmotion },
    { text: 'Detectada anomalía en la red. Protocolos de combate listos.', emotion: 'combate' as JarvisEmotion },
    { text: 'Compilando arquitectura Electron con soporte para img2threejs...', emotion: 'curioso' as JarvisEmotion },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 pointer-events-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-cyan-400/40 shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-900/50 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-400/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                LABORATORIO 3D & CINEMÁTICA AVANZADA
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  EXBER-AVATAR V1.1
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Prueba en vivo de saltos, emociones del visor, sincronización labial y props holográficos.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('poses')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'poses'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🎬 Movimientos & Poses ({actionsList.length})
          </button>
          <button
            onClick={() => setActiveTab('expressions')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'expressions'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ✨ Expresiones del Visor ({emotionsList.length})
          </button>
          <button
            onClick={() => setActiveTab('lipsync')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'lipsync'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🎙️ Sincronización Labial & Fonemas
          </button>
          <button
            onClick={() => setActiveTab('references')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'references'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🖼️ Hojas de Referencia (Subidas por Facu)
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: POSES & MOVEMENTS */}
          {activeTab === 'poses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                  Acciones Narrativas & Físicas Cinemáticas
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Estado actual: <strong className="text-cyan-300 uppercase">{currentAction}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {actionsList.map((act) => {
                  const Icon = act.icon;
                  const isSelected = currentAction === act.id;
                  return (
                    <button
                      key={act.id}
                      onClick={() => onSelectAction(act.id, act.emotion, act.phrase)}
                      className={`flex items-start gap-3.5 p-3.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                      }`}
                    >
                      <div className={`p-2.5 rounded-lg shrink-0 ${isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-cyan-400'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-slate-100">{act.label}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                            {act.emotion}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed mb-2">
                          {act.desc}
                        </p>
                        <div className="text-[11px] font-mono text-cyan-300/80 italic flex items-center gap-1.5">
                          <Volume2 className="w-3 h-3 text-cyan-400" />
                          <span>"{act.phrase}"</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Camera Presets Selector */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-cyan-400" /> Ángulo de cámara:
                </span>
                <div className="flex gap-2">
                  {(['default', 'closeup', 'overview', 'fullbody'] as const).map((cam) => (
                    <button
                      key={cam}
                      onClick={() => setCameraPreset(cam)}
                      className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-all ${
                        cameraPreset === cam
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cam === 'default' ? 'Vista Normal' : cam === 'closeup' ? 'Primer Plano (Visor)' : cam === 'overview' ? 'Panorámica 3D' : 'Cuerpo Completo'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FACIAL EXPRESSIONS */}
          {activeTab === 'expressions' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 font-mono">
                Las expresiones se dibujan proceduralmente en el visor LED del avatar con emisividad y brillo cyan/magenta/verde esmeralda, basadas fielmente en la <strong>Hoja de Referencia V1.1</strong>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {emotionsList.map((emo) => {
                  const isSelected = currentEmotion === emo.id;
                  return (
                    <button
                      key={emo.id}
                      onClick={() => onSelectEmotion(emo.id)}
                      className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? `bg-cyan-500/15 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]`
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{emo.icon}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${emo.color}`}>
                          {emo.id.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-100 mb-1">{emo.label}</span>
                      <p className="text-[11px] text-slate-400 leading-snug">{emo.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: LIP-SYNC & VOICE PHONEMES */}
          {activeTab === 'lipsync' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30">
                <h3 className="text-xs font-bold font-mono tracking-wider text-cyan-300 uppercase mb-2">
                  TELEMETRÍA DE SINCRONIZACIÓN LABIAL EN VIVO
                </h3>
                <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block">Volumen Acústico:</span>
                    <span className="text-base font-bold text-emerald-400">
                      {(lipSyncData.volume * 100).toFixed(0)}%
                    </span>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="bg-emerald-400 h-full rounded-full transition-all duration-75"
                        style={{ width: `${lipSyncData.volume * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Frecuencia Vocal:</span>
                    <span className="text-base font-bold text-cyan-400">
                      {lipSyncData.frequency.toFixed(0)} Hz
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Fonema / Viseme:</span>
                    <span className="text-base font-bold text-fuchsia-400 uppercase">
                      {lipSyncData.viseme}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-mono text-slate-400 block mb-2">
                  Probar frases en español con respuesta auditiva y movimiento labial sincronizado:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {testPhrases.map((phrase, i) => (
                    <button
                      key={i}
                      onClick={() => onTestPhrase(phrase.text, phrase.emotion)}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 text-left transition-colors group"
                    >
                      <span className="text-xs text-slate-200 font-mono group-hover:text-cyan-300">
                        "{phrase.text}"
                      </span>
                      <Volume2 className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ORIGINAL REFERENCE IMAGES */}
          {activeTab === 'references' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                Estas son las hojas de diseño y concept art que subiste en tu consulta. El modelo 3D y los shaders del avatar fueron construidos siguiendo estas especificaciones exactas:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="aspect-video rounded-lg overflow-hidden border border-cyan-500/40 bg-black">
                    <img 
                      src="/assets/aistudio/Avatar_JARVIS_en_sala_de_control_neon_79427a9f.png" 
                      alt="Avatar JARVIS en sala de control neon"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs font-mono text-cyan-300 block font-semibold">
                    1. JARVIS en Sala de Control
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Diseño principal de la sala cibernética, trono y HUD.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="aspect-video rounded-lg overflow-hidden border border-cyan-500/40 bg-black">
                    <img 
                      src="/assets/aistudio/Gemini_Generated_Image_dwf0a7dwf0a7dwf0_feca4c05.jpeg" 
                      alt="Hoja de referencia de animación profesional V1.1"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs font-mono text-cyan-300 block font-semibold">
                    2. Hoja de Animación & Expresiones V1.1
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Celebración de victoria (salto), saludo, modo técnico y expresiones faciales.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="aspect-video rounded-lg overflow-hidden border border-cyan-500/40 bg-black">
                    <img 
                      src="/assets/aistudio/preview_sample_8c7eef17.png" 
                      alt="Muestras de poses y mano abierta"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs font-mono text-cyan-300 block font-semibold">
                    3. Guía de Poses y Gesto de Saludo Abierto
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Detalle de guantelete con palma LED y posturas de combate.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-cyan-900/40 bg-slate-950/90 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Mantén pulsado Shift + Arrastrar el mouse en el visor para girar en 360°.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors"
          >
            Volver a Sala Principal
          </button>
        </div>
      </div>
    </div>
  );
};
