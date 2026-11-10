import React from 'react';
import { Mic, MicOff, Volume2, Sparkles } from 'lucide-react';
import { VoiceLipSyncData } from '../types/jarvis';

interface MuseVoiceOrbProps {
  isListening: boolean;
  isSpeaking: boolean;
  lipSyncData: VoiceLipSyncData;
  onToggleMic: () => void;
  statusLabel?: string;
}

export const MuseVoiceOrb: React.FC<MuseVoiceOrbProps> = ({
  isListening,
  isSpeaking,
  lipSyncData,
  onToggleMic,
  statusLabel = 'Tocá o presioná [ESPACIO] para hablar con Dee',
}) => {
  const vol = lipSyncData.volume || 0;
  const pulseScale = isSpeaking 
    ? 1 + vol * 0.45 
    : isListening 
    ? 1.15 
    : 1.0;

  return (
    <div className="flex flex-col items-center justify-center select-none pointer-events-auto">
      {/* Dynamic Voice Acoustic Ring & Orb Container */}
      <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32">
        {/* Outer ambient glow */}
        <div
          className={`absolute inset-0 rounded-full blur-2xl transition-all duration-300 pointer-events-none ${
            isListening
              ? 'bg-rose-500/40 scale-125'
              : isSpeaking
              ? 'bg-cyan-400/40 scale-125'
              : 'bg-cyan-500/20 group-hover:bg-cyan-400/30'
          }`}
          style={{
            transform: `scale(${pulseScale * 1.2})`,
          }}
        />

        {/* Outer orbital reactive sonic ring */}
        <div
          className={`absolute inset-1 rounded-full border border-dashed transition-all duration-500 pointer-events-none ${
            isListening
              ? 'border-rose-400 animate-spin-slow opacity-90'
              : isSpeaking
              ? 'border-cyan-300 animate-spin-reverse opacity-80'
              : 'border-cyan-500/30 opacity-40'
          }`}
          style={{
            transform: `scale(${pulseScale * 1.1})`,
            animationDuration: isListening || isSpeaking ? '4s' : '16s',
          }}
        />

        {/* Secondary sonic wave ripples (active when speaking/listening) */}
        {(isListening || isSpeaking) && (
          <>
            <span 
              className={`absolute inset-0 rounded-full animate-ping pointer-events-none opacity-40 ${
                isListening ? 'bg-rose-500' : 'bg-cyan-400'
              }`}
            />
            <span 
              className={`absolute inset-2 rounded-full border pointer-events-none opacity-60 ${
                isListening ? 'border-rose-300' : 'border-fuchsia-400'
              }`}
              style={{
                transform: `scale(${1 + vol * 0.6})`,
                transition: 'transform 0.08s ease-out',
              }}
            />
          </>
        )}

        {/* Central Core Interactive Button */}
        <button
          onClick={onToggleMic}
          className={`relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex flex-col items-center justify-center transition-all duration-300 backdrop-blur-xl border shadow-2xl cursor-pointer ${
            isListening
              ? 'bg-gradient-to-tr from-rose-600 to-rose-400 border-rose-300 text-white shadow-[0_0_35px_rgba(244,63,94,0.85)] scale-105'
              : isSpeaking
              ? 'bg-gradient-to-tr from-cyan-600 via-sky-500 to-fuchsia-500 border-cyan-200 text-slate-950 shadow-[0_0_35px_rgba(0,240,255,0.8)]'
              : 'bg-slate-950/80 hover:bg-slate-900 border-cyan-500/50 hover:border-cyan-300 text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:scale-105 active:scale-95'
          }`}
          style={{
            transform: `scale(${pulseScale})`,
          }}
          title={isListening ? 'Detener micrófono' : 'Hablar con Dee (Espacio)'}
        >
          {isListening ? (
            <MicOff className="w-7 h-7 animate-pulse text-white" />
          ) : isSpeaking ? (
            <Volume2 className="w-7 h-7 text-slate-950 animate-bounce" />
          ) : (
            <Mic className="w-7 h-7 transition-transform group-hover:scale-110" />
          )}

          {/* Equalizer Frequency Mini Bars when Speaking */}
          {isSpeaking && (
            <div className="absolute -bottom-2 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-slate-950/90 border border-cyan-400/60 shadow-lg">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-1 bg-cyan-400 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(4, Math.min(16, vol * 30 * (0.5 + Math.sin(Date.now() * 0.01 + i) * 0.5)))}px`,
                  }}
                />
              ))}
            </div>
          )}
        </button>
      </div>

      {/* Subtitle / Status Prompt Guide */}
      <div className="mt-2 text-center pointer-events-none">
        <p className="text-[11px] sm:text-xs font-mono font-medium tracking-wide transition-colors text-slate-300 flex items-center justify-center gap-1.5">
          {isListening ? (
            <span className="text-rose-400 font-bold flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Escuchando tu voz... Hablale a Dee
            </span>
          ) : isSpeaking ? (
            <span className="text-cyan-300 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              Dee respondiendo en tiempo real...
            </span>
          ) : (
            <span className="text-slate-400 hover:text-slate-200 transition-colors">
              {statusLabel}
            </span>
          )}
        </p>
      </div>
    </div>
  );
};
