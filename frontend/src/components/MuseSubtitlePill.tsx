import React from 'react';
import { Volume2, RotateCcw } from 'lucide-react';
import { JarvisEmotion } from '../types/jarvis';

interface MuseSubtitlePillProps {
  text: string;
  isSpeaking: boolean;
  emotion: JarvisEmotion;
  onReplayVoice?: () => void;
  onDismiss?: () => void;
}

export const MuseSubtitlePill: React.FC<MuseSubtitlePillProps> = ({
  text,
  isSpeaking,
  emotion,
  onReplayVoice,
  onDismiss,
}) => {
  if (!text) return null;

  const emotionGlow: Record<JarvisEmotion, string> = {
    curioso: 'border-cyan-400/40 shadow-[0_0_20px_rgba(0,240,255,0.15)] text-cyan-300',
    orgullo: 'border-emerald-400/50 shadow-[0_0_20px_rgba(74,222,128,0.2)] text-emerald-300',
    combate: 'border-rose-400/50 shadow-[0_0_20px_rgba(244,63,94,0.2)] text-rose-300',
    alivio: 'border-sky-400/40 shadow-[0_0_20px_rgba(56,189,248,0.15)] text-sky-300',
    desden: 'border-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.15)] text-purple-300',
    melancolia: 'border-fuchsia-400/40 shadow-[0_0_20px_rgba(236,72,153,0.15)] text-fuchsia-300',
    neutro: 'border-cyan-400/40 shadow-[0_0_20px_rgba(0,240,255,0.15)] text-cyan-300',
  };
  const activeGlow = emotionGlow[emotion] || emotionGlow.curioso;

  return (
    <div className="w-full max-w-xl mx-auto pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
      <div className={`relative px-4 py-3 rounded-2xl bg-slate-950/80 backdrop-blur-xl border ${activeGlow} flex items-center gap-3.5`}>
        {/* Avatar Mini Indicator */}
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-900 border border-cyan-400/50 flex items-center justify-center font-mono font-bold text-xs text-cyan-300 shadow-sm">
          {isSpeaking ? (
            <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />
          ) : (
            'DEE'
          )}
        </div>

        {/* Spoken text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400">
              DEE AGENT
            </span>
            {isSpeaking && (
              <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                HABLANDO
              </span>
            )}
          </div>
          <p className="text-xs sm:text-[13px] text-slate-100 font-medium leading-relaxed font-sans line-clamp-3">
            {text}
          </p>
        </div>

        {/* Quick Replay button */}
        {onReplayVoice && (
          <button
            onClick={onReplayVoice}
            className="flex-shrink-0 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors border border-slate-800"
            title="Repetir voz de Dee"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
