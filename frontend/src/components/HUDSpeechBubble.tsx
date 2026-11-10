import React, { useState } from 'react';
import { Volume2, VolumeX, MessageSquare, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { JarvisEmotion } from '../types/jarvis';

interface HUDSpeechBubbleProps {
  text: string;
  isSpeaking: boolean;
  emotion: JarvisEmotion;
  onReplayVoice: () => void;
  onStopVoice: () => void;
}

export const HUDSpeechBubble: React.FC<HUDSpeechBubbleProps> = ({
  text,
  isSpeaking,
  emotion,
  onReplayVoice,
  onStopVoice,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const getEmotionLabel = (e: JarvisEmotion) => {
    switch (e) {
      case 'orgullo': return { label: 'VICTORIA ⭐⭐', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' };
      case 'combate': return { label: 'COMBATE ⚔️', color: 'text-fuchsia-400 border-fuchsia-500/40 bg-fuchsia-500/10' };
      case 'melancolia': return { label: 'MEMORIA ✖✖', color: 'text-pink-400 border-pink-500/40 bg-pink-500/10' };
      case 'desden': return { label: 'CRÍTICO ━', color: 'text-rose-400 border-rose-500/40 bg-rose-500/10' };
      case 'alivio': return { label: 'ALIVIO ◠◠', color: 'text-teal-400 border-teal-500/40 bg-teal-500/10' };
      case 'curioso': return { label: 'EN LÍNEA ◉◉', color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10' };
      default: return { label: 'STANDBY', color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10' };
    }
  };

  const emotionMeta = getEmotionLabel(emotion);

  // Minimized Sleek Pill
  if (isMinimized) {
    return (
      <div className="relative z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/90 border border-cyan-500/40 shadow-[0_0_20px_rgba(0,0,0,0.8)] pointer-events-auto transition-all animate-fadeIn">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-[10px] font-mono font-bold text-cyan-300">DEE:</span>
        <span className="text-[11px] text-slate-300 font-medium max-w-[260px] truncate">
          {text}
        </span>
        <button
          onClick={() => setIsMinimized(false)}
          className="p-1 rounded text-cyan-400 hover:text-white hover:bg-cyan-900/50 transition-colors ml-1"
          title="Expandir diálogo"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Expanded Compact Dialogue Container
  return (
    <div className="relative z-20 max-w-[340px] sm:max-w-[380px] p-3 rounded-2xl bg-slate-950/95 border border-cyan-500/50 shadow-[0_0_30px_rgba(0,0,0,0.9)] pointer-events-auto transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-cyan-950/60">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3 text-cyan-400" />
          <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-300">
            DEE // RESPUESTA
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${emotionMeta.color}`}>
            {emotionMeta.label}
          </span>

          <button
            onClick={isSpeaking ? onStopVoice : onReplayVoice}
            className="p-1 rounded text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/60 transition-colors"
            title={isSpeaking ? 'Detener voz' : 'Repetir voz'}
          >
            {isSpeaking ? (
              <VolumeX className="w-3 h-3 text-fuchsia-400" />
            ) : (
              <Volume2 className="w-3 h-3" />
            )}
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Minimizar panel"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main text */}
      <p className="text-xs sm:text-[13px] font-medium text-slate-100 leading-snug tracking-wide">
        {text}
      </p>

      {/* Audio Waveform Bar */}
      <div className="mt-2 flex items-center justify-between pt-1 border-t border-cyan-900/30">
        <div className="flex items-center gap-0.5 h-3">
          {Array.from({ length: 18 }).map((_, i) => {
            const height = isSpeaking 
              ? Math.max(3, Math.sin(Date.now() / 140 + i * 0.5) * 10 + 6) 
              : 3;
            return (
              <div
                key={i}
                className={`w-0.5 rounded-full transition-all duration-75 ${
                  isSpeaking 
                    ? 'bg-gradient-to-t from-cyan-400 to-sky-300 shadow-[0_0_6px_rgba(56,189,248,0.8)]' 
                    : 'bg-cyan-900/30'
                }`}
                style={{ height: `${height}px` }}
              />
            );
          })}
        </div>
        <span className="text-[9px] font-mono text-cyan-400/60">
          {isSpeaking ? 'MODULANDO AUDIO' : 'CANAL LISTO'}
        </span>
      </div>
    </div>
  );
};
