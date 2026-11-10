import React, { useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Keyboard, 
  Send, 
  Settings2, 
  Sparkles, 
  Activity, 
  Hand, 
  Zap, 
  Code, 
  Compass, 
  Layers, 
  LogOut 
} from 'lucide-react';
import { JarvisAction, JarvisEmotion } from '../types/jarvis';

interface HUDAudioBarProps {
  isListening: boolean;
  onToggleMic: () => void;
  onSubmitPrompt: (text: string) => void;
  onTriggerAction: (action: JarvisAction, emotion: JarvisEmotion, spokenText: string) => void;
  onTriggerEmotion: (emotion: JarvisEmotion) => void;
  currentAction: JarvisAction;
  currentEmotion: JarvisEmotion;
}

export const HUDAudioBar: React.FC<HUDAudioBarProps> = ({
  isListening,
  onToggleMic,
  onSubmitPrompt,
  onTriggerAction,
  onTriggerEmotion,
  currentAction,
  currentEmotion,
}) => {
  const [inputText, setInputText] = useState('');
  const [showKeyboardInput, setShowKeyboardInput] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSubmitPrompt(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className="relative z-30 flex flex-col items-center gap-2.5 max-w-2xl w-full mx-auto pointer-events-auto">
      {/* Quick Action Chips directly matching Facu's challenging requirements! */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/90 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] text-xs">
        <button
          onClick={() => onTriggerAction('celebracion_salto', 'orgullo', '¡Excelente trabajo Facu! ¡Victoria completada con éxito!')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-bold transition-all ${
            currentAction === 'celebracion_salto'
              ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(74,222,128,0.6)]'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
          }`}
          title="El avatar salta con puño en alto y partículas de victoria"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>🚀 Saltar de Alegría</span>
        </button>

        <button
          onClick={() => onTriggerAction('saludo', 'curioso', '¡Hola Facu! Es un gusto saludarte. JARVIS a tu entera disposición.')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all ${
            currentAction === 'saludo'
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.6)]'
              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
          }`}
        >
          <Hand className="w-3.5 h-3.5" />
          <span>👋 Saludarme</span>
        </button>

        <button
          onClick={() => onTriggerAction('trabajando', 'curioso', 'Iniciando compilación y análisis de código en pantallas holográficas.')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all ${
            currentAction === 'trabajando'
              ? 'bg-sky-500 text-slate-950 shadow-[0_0_12px_rgba(14,165,233,0.6)]'
              : 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>💻 Trabajar</span>
        </button>

        <button
          onClick={() => onTriggerAction('manipular_datos', 'curioso', 'Extrayendo matrices de datos y rotando cubo cuántico holográfico.')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all ${
            currentAction === 'manipular_datos'
              ? 'bg-fuchsia-500 text-slate-950 shadow-[0_0_12px_rgba(217,70,239,0.6)]'
              : 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 hover:bg-fuchsia-500/30'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>📊 Datos</span>
        </button>

        <button
          onClick={() => onTriggerAction('explicacion', 'curioso', 'Te explico detalladamente: conectamos img2threejs para generar el rig y Electron para la ventana transparente.')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all ${
            currentAction === 'explicacion'
              ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>🗣️ Explicar</span>
        </button>

        <button
          onClick={() => onTriggerAction('despedida', 'alivio', 'Hasta luego, Facu. Pasando a reposo. Estaré alerta si me necesitas.')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all ${
            currentAction === 'despedida'
              ? 'bg-rose-500 text-slate-950 shadow-[0_0_12px_rgba(244,63,94,0.6)]'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
          }`}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>😴 Despedirse</span>
        </button>
      </div>

      {/* Main Bar from Screenshot */}
      <div className="relative w-full flex items-center justify-between px-5 py-2.5 rounded-2xl bg-slate-950/90 border border-cyan-400/40 shadow-[0_0_25px_rgba(6,182,212,0.2)]">
        {/* Left: Waveform Icon & Keyboard Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 text-cyan-400">
            <span className="w-0.5 h-3 bg-cyan-400 rounded-full animate-pulse" />
            <span className="w-0.5 h-5 bg-cyan-300 rounded-full" />
            <span className="w-0.5 h-2 bg-cyan-500 rounded-full" />
            <span className="w-0.5 h-4 bg-cyan-400 rounded-full" />
          </div>

          <button
            onClick={() => setShowKeyboardInput(!showKeyboardInput)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showKeyboardInput
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Escribir texto con el teclado"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Microphone or Input */}
        <div className="flex-1 flex items-center justify-center px-4">
          {showKeyboardInput ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full max-w-md">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Escribe una orden o pregunta a JARVIS..."
                className="flex-1 px-3.5 py-1.5 text-xs font-mono bg-slate-900/90 border border-cyan-500/50 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                autoFocus
              />
              <button
                type="submit"
                className="p-1.5 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors font-bold"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              onClick={onToggleMic}
              className={`flex items-center gap-3 px-6 py-2 rounded-xl transition-all ${
                isListening
                  ? 'bg-fuchsia-500/25 border border-fuchsia-400 text-fuchsia-200 shadow-[0_0_20px_rgba(236,72,153,0.4)]'
                  : 'bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/25 hover:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              }`}
            >
              <div className={`p-2 rounded-full ${isListening ? 'bg-fuchsia-500 text-slate-950' : 'bg-cyan-500 text-slate-950'}`}>
                {isListening ? <Mic className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
              </div>
              <span className="text-xs font-semibold tracking-wider">
                {isListening ? 'Escuchando tu voz...' : 'Hablá con JARVIS...'}
              </span>
            </button>
          )}
        </div>

        {/* Right Settings */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>MIC: LISTO</span>
          </div>
          <button 
            onClick={() => onTriggerEmotion(currentEmotion === 'orgullo' ? 'combate' : 'orgullo')}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
            title="Cambiar expresión del visor"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
