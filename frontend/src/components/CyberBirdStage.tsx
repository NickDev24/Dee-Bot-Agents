import React, { useRef, useEffect, useState, useMemo } from 'react';
import { JarvisAction, JarvisEmotion, VoiceLipSyncData } from '../types/jarvis';

interface CyberBirdStageProps {
  currentAction: JarvisAction;
  currentEmotion: JarvisEmotion;
  lipSyncData: VoiceLipSyncData;
  cameraPreset?: 'default' | 'closeup' | 'overview' | 'fullbody';
}

export const CyberBirdStage: React.FC<CyberBirdStageProps> = ({
  currentAction,
  currentEmotion,
  lipSyncData,
  cameraPreset = 'default',
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Periodic natural blinking
  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3600);
    return () => clearInterval(interval);
  }, []);

  // Parallax mouse tracker
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMousePos({ x, y });
  };

  // Emotion-driven color palettes
  const emotionTheme = useMemo(() => {
    switch (currentEmotion) {
      case 'orgullo':
        return {
          primary: '#4ade80',
          secondary: '#fbbf24',
          glow: 'rgba(74, 222, 128, 0.7)',
          badge: '⭐ VICTORIA TÉCNICA // 100% OK',
          halo: 'from-emerald-500/20 via-yellow-400/10 to-transparent',
        };
      case 'combate':
        return {
          primary: '#ff007f',
          secondary: '#a855f7',
          glow: 'rgba(255, 0, 127, 0.75)',
          badge: '⚔️ MODO COMBATE // FIREWALL MÁXIMO',
          halo: 'from-rose-500/20 via-fuchsia-500/10 to-transparent',
        };
      case 'desden':
        return {
          primary: '#f97316',
          secondary: '#06b6d4',
          glow: 'rgba(249, 115, 22, 0.7)',
          badge: '😏 EVALUACIÓN CRÍTICA // CERO TOLERANCIA',
          halo: 'from-orange-500/20 via-cyan-500/10 to-transparent',
        };
      case 'alivio':
        return {
          primary: '#2dd4bf',
          secondary: '#38bdf8',
          glow: 'rgba(45, 212, 191, 0.7)',
          badge: '😌 MEMORIA REESTABLECIDA // STANDBY',
          halo: 'from-teal-500/20 via-cyan-500/10 to-transparent',
        };
      case 'melancolia':
        return {
          primary: '#e879f9',
          secondary: '#60a5fa',
          glow: 'rgba(232, 121, 249, 0.7)',
          badge: '🌧️ RECUERDO NOSTÁLGICO // LOG REWIND',
          halo: 'from-purple-500/20 via-blue-500/10 to-transparent',
        };
      case 'curioso':
      default:
        return {
          primary: '#00f0ff',
          secondary: '#0ea5e9',
          glow: 'rgba(0, 240, 255, 0.75)',
          badge: '⚡ KRONOS ONLINE // ANÁLISIS ACTIVO',
          halo: 'from-cyan-500/20 via-blue-500/10 to-transparent',
        };
    }
  }, [currentEmotion]);

  // Dynamic Camera scale presets
  const getCameraClass = () => {
    switch (cameraPreset) {
      case 'closeup':
        return 'scale-115 translate-y-4';
      case 'overview':
        return 'scale-90 -translate-y-2';
      case 'fullbody':
        return 'scale-100 translate-y-0';
      case 'default':
      default:
        return 'scale-105 translate-y-0';
    }
  };

  // Lip-sync calculation for beak opening
  const beakOpening = Math.min(22, Math.max(0, lipSyncData.volume * 24));
  const eqBarHeights = [
    Math.min(24, 4 + lipSyncData.volume * 22 * (Math.sin(Date.now() / 90) * 0.4 + 0.6)),
    Math.min(28, 6 + lipSyncData.volume * 26 * (Math.sin(Date.now() / 80 + 1) * 0.4 + 0.6)),
    Math.min(32, 8 + lipSyncData.volume * 30 * (Math.sin(Date.now() / 70 + 2) * 0.4 + 0.6)),
    Math.min(26, 5 + lipSyncData.volume * 24 * (Math.sin(Date.now() / 85 + 3) * 0.4 + 0.6)),
  ];

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-full overflow-hidden select-none bg-[#03060c] flex items-center justify-center"
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 40%, rgba(0, 240, 255, 0.08) 0%, transparent 60%),
          radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.06) 0%, transparent 50%),
          linear-gradient(to bottom, #020408, #040914 70%, #02050b)
        `,
      }}
    >
      {/* 1. Subtle High-Tech Perspective Grid Floor */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none opacity-25"
        style={{
          background: 'linear-gradient(transparent, rgba(0, 240, 255, 0.15)), repeating-linear-gradient(90deg, rgba(0, 240, 255, 0.15) 0, rgba(0, 240, 255, 0.15) 1px, transparent 1px, transparent 40px)',
          transform: 'perspective(500px) rotateX(65deg)',
          transformOrigin: 'bottom center',
        }}
      />

      {/* 2. Ambient Particles & Digital Dust */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[10, 25, 45, 60, 75, 88].map((left, idx) => (
          <div
            key={idx}
            className="absolute w-1 h-1 rounded-full bg-cyan-400/40 animate-pulse"
            style={{
              left: `${left}%`,
              top: `${(idx * 17) % 80 + 10}%`,
              boxShadow: '0 0 8px rgba(0,240,255,0.6)',
              animationDuration: `${2.5 + (idx % 3)}s`,
            }}
          />
        ))}
      </div>

      {/* 3. CENTERSTAGE MASCOT RIG CONTAINER */}
      <div
        className={`relative flex flex-col items-center justify-center transition-all duration-300 ease-out origin-center ${getCameraClass()}`}
        style={{
          transform: `translate3d(${mousePos.x * 12}px, ${mousePos.y * 10}px, 0)`,
        }}
      >
        {/* ACTION: CELEBRACIÓN DE SALTO (High-Energy Bounce + Confetti & Particles) */}
        {currentAction === 'celebracion_salto' && (
          <div className="absolute -top-16 z-40 flex flex-col items-center animate-bounce pointer-events-none">
            <div className="px-5 py-2 rounded-full bg-emerald-500/30 border-2 border-emerald-400 text-emerald-300 font-mono font-bold tracking-widest text-xs shadow-[0_0_30px_rgba(74,222,128,0.8)] flex items-center gap-2">
              <span className="text-base">⭐</span>
              <span>¡VICTORIA! COMPILACIÓN LIMPIA EN TIEMPO RÉCORD</span>
              <span className="text-base">⭐</span>
            </div>
            <div className="flex gap-4 mt-2">
              <span className="text-yellow-400 text-lg animate-ping">✨</span>
              <span className="text-emerald-400 text-lg animate-pulse">⚡</span>
              <span className="text-cyan-400 text-lg animate-ping">✨</span>
            </div>
          </div>
        )}

        {/* ACTION: MODO TRABAJANDO (Floating Holographic Code Matrices & Terminals) */}
        {currentAction === 'trabajando' && (
          <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-between w-[800px] -left-[180px]">
            {/* Left Hologram: Hermes Agent Autonomous Loop */}
            <div className="w-56 p-3 rounded-xl bg-slate-950/90 border border-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,0.3)] font-mono text-[10px] text-cyan-300 transform -rotate-3 transition-transform">
              <div className="flex items-center justify-between border-b border-cyan-900/60 pb-1 mb-1 font-bold text-cyan-400">
                <span>HERMES::LOOP</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <p className="text-slate-400">&gt; &lt;think&gt; Analizando AST...</p>
              <p>&gt; Optimizing tool dispatch</p>
              <p className="text-emerald-400 font-bold">&gt; Latencia: 0.8ms [FAST]</p>
              <p className="text-yellow-400">&gt; &lt;reflection&gt; 0 syntax errs</p>
            </div>

            {/* Right Hologram: Rakazo Vector Memory & OpenGrok Fabric */}
            <div className="w-56 p-3 rounded-xl bg-slate-950/90 border border-fuchsia-400/60 shadow-[0_0_25px_rgba(236,72,153,0.3)] font-mono text-[10px] text-fuchsia-300 transform rotate-3 transition-transform">
              <div className="flex items-center justify-between border-b border-fuchsia-900/60 pb-1 mb-1 font-bold text-fuchsia-400">
                <span>RAKAZO::MEMORY</span>
                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
              </div>
              <p className="text-slate-400">&gt; Vector embedding sync</p>
              <p>&gt; Ollama 8B: Warm (3.1ms)</p>
              <p className="text-cyan-300">&gt; Sub-agentes: 4 activos</p>
              <p className="text-emerald-400 font-bold">&gt; Sandboxed Terminal: OK</p>
            </div>
          </div>
        )}

        {/* ACTION: MANIPULACIÓN DE DATOS (Floating Quantum Data Orb) */}
        {currentAction === 'manipular_datos' && (
          <div className="absolute -bottom-8 z-30 pointer-events-none flex flex-col items-center">
            <div className="w-24 h-24 rounded-full border-2 border-dashed border-cyan-400/80 shadow-[0_0_35px_rgba(0,240,255,0.7)] flex items-center justify-center animate-spin">
              <div className="w-16 h-16 rounded-full border border-fuchsia-400/70 flex items-center justify-center">
                <div className="text-[9px] font-mono font-bold text-cyan-300 tracking-wider">
                  DATA 4D
                </div>
              </div>
            </div>
            <div className="mt-2 px-3 py-1 rounded bg-slate-950/90 border border-cyan-500 text-[10px] font-mono text-cyan-300 font-bold">
              ORBE CUÁNTICO // 1.2M VECTORES
            </div>
          </div>
        )}

        {/* ACTION: SALUDO ABIERTO (Wing Salute Glow Banner) */}
        {currentAction === 'saludo' && (
          <div className="absolute -top-12 z-30 pointer-events-none px-4 py-1.5 rounded-full bg-cyan-950/90 border border-cyan-400 text-cyan-300 font-mono text-xs font-bold shadow-[0_0_20px_rgba(0,240,255,0.6)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>¡SALUDO TÁCTICO! // KRONOS LISTO PARA EL COMBATE</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MAIN CYBER-BIRD AVATAR BODY CONTAINER                         */}
        {/* ------------------------------------------------------------- */}
        <div
          className={`relative w-[420px] h-[420px] sm:w-[460px] sm:h-[460px] flex items-center justify-center transition-all duration-300 ${
            currentAction === 'celebracion_salto'
              ? 'transform -translate-y-12 rotate-[-4deg] scale-105'
              : currentAction === 'trabajando'
              ? 'transform translate-y-1 scale-100'
              : 'hover:scale-[1.02]'
          }`}
          style={{
            animation: currentAction === 'idle' ? 'floatBreathing 4s ease-in-out infinite' : undefined,
          }}
        >
          {/* Ambient Radial Backlight Glow Behind Avatar */}
          <div
            className={`absolute inset-0 rounded-full blur-2xl opacity-60 transition-colors duration-500 bg-gradient-to-tr ${emotionTheme.halo}`}
          />

          {/* High-Resolution Mascot Artwork (Angry Birds Cybernetic Bird) */}
          <img
            src="/assets/cyber_bird_avatar.jpg"
            alt="KRONOS Cyber-Bird Mascot"
            className="relative z-10 w-full h-full object-contain rounded-3xl drop-shadow-[0_15px_35px_rgba(0,0,0,0.8)] filter brightness-105 contrast-105 pointer-events-none"
          />

          {/* ------------------------------------------------------------- */}
          {/* DYNAMIC FACIAL OVERLAY RIG: CONCENTRIC HUD EYES & EYEBROWS   */}
          {/* Precision mapped over the bird's eye apertures                */}
          {/* ------------------------------------------------------------- */}
          <div className="absolute z-20 pointer-events-none inset-0 flex items-center justify-center">
            {/* SVG Interactive Rig for Left & Right Eye Apertures + Brows */}
            <svg
              viewBox="0 0 460 460"
              className="w-full h-full"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Dynamic Eyebrow Angle Adjuster based on Emotion */}
              <g className="transition-all duration-300">
                {currentEmotion === 'combate' && (
                  <>
                    {/* Fierce Combat Furrow Eyebrow Bars */}
                    <line
                      x1="180" y1="165" x2="238" y2="192"
                      stroke={emotionTheme.primary}
                      strokeWidth="5"
                      strokeLinecap="round"
                      filter="url(#neonGlow)"
                    />
                    <line
                      x1="340" y1="172" x2="285" y2="198"
                      stroke={emotionTheme.primary}
                      strokeWidth="5"
                      strokeLinecap="round"
                      filter="url(#neonGlow)"
                    />
                  </>
                )}

                {currentEmotion === 'desden' && (
                  <>
                    {/* Sarcastic / Critical Raised Brow */}
                    <path
                      d="M 180 160 Q 210 148 240 166"
                      stroke={emotionTheme.primary}
                      strokeWidth="4"
                      fill="none"
                      strokeLinecap="round"
                      filter="url(#neonGlow)"
                    />
                    <line
                      x1="335" y1="185" x2="285" y2="195"
                      stroke={emotionTheme.primary}
                      strokeWidth="4"
                      strokeLinecap="round"
                      filter="url(#neonGlow)"
                    />
                  </>
                )}
              </g>

              {/* --------------------------------------------------------- */}
              {/* LEFT EYE (Center ~ x: 236, y: 202)                       */}
              {/* --------------------------------------------------------- */}
              <g transform="translate(236, 202)">
                {blink ? (
                  // Blinking horizontal slit
                  <line
                    x1="-24" y1="0" x2="24" y2="0"
                    stroke={emotionTheme.primary}
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#neonGlow)"
                  />
                ) : currentEmotion === 'orgullo' ? (
                  // ⭐ STAR EYE FOR VICTORY & PRIDE
                  <g filter="url(#neonGlow)">
                    <polygon
                      points="0,-18 5,-5 18,-4 8,5 11,18 0,10 -11,18 -8,5 -18,-4 -5,-5"
                      fill={emotionTheme.primary}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </g>
                ) : currentEmotion === 'combate' ? (
                  // COMBAT RETICLE: Fierce focused pupil
                  <g filter="url(#neonGlow)">
                    <circle cx="0" cy="0" r="14" fill="none" stroke={emotionTheme.primary} strokeWidth="3" />
                    <circle cx={mousePos.x * 4} cy={mousePos.y * 3} r="7" fill={emotionTheme.primary} />
                    <line x1="-18" y1="0" x2="18" y2="0" stroke={emotionTheme.primary} strokeWidth="1.5" />
                    <line x1="0" y1="-18" x2="0" y2="18" stroke={emotionTheme.primary} strokeWidth="1.5" />
                  </g>
                ) : currentEmotion === 'melancolia' ? (
                  // NOSTALGIA: ✖ CYBER
                  <g filter="url(#neonGlow)">
                    <line x1="-12" y1="-12" x2="12" y2="12" stroke={emotionTheme.primary} strokeWidth="4" strokeLinecap="round" />
                    <line x1="12" y1="-12" x2="-12" y2="12" stroke={emotionTheme.primary} strokeWidth="4" strokeLinecap="round" />
                  </g>
                ) : currentEmotion === 'alivio' ? (
                  // ALIVIO: Curved smiling arc
                  <path
                    d="M -16 4 Q 0 -12 16 4"
                    fill="none"
                    stroke={emotionTheme.primary}
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#neonGlow)"
                  />
                ) : (
                  // CURIOSO / DEFAULT: Concentric cyan aperture with tracking pupil
                  <g filter="url(#neonGlow)">
                    <circle cx="0" cy="0" r="15" fill="none" stroke={emotionTheme.primary} strokeWidth="2" strokeDasharray="3 2" />
                    <circle cx={mousePos.x * 5} cy={mousePos.y * 4} r="8" fill={emotionTheme.primary} />
                    <circle cx={mousePos.x * 5 - 2} cy={mousePos.y * 4 - 2} r="2.5" fill="#ffffff" />
                  </g>
                )}
              </g>

              {/* --------------------------------------------------------- */}
              {/* RIGHT EYE (Center ~ x: 326, y: 214)                      */}
              {/* --------------------------------------------------------- */}
              <g transform="translate(326, 214)">
                {blink ? (
                  <line
                    x1="-20" y1="0" x2="20" y2="0"
                    stroke={emotionTheme.primary}
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#neonGlow)"
                  />
                ) : currentEmotion === 'orgullo' ? (
                  // ⭐ STAR EYE FOR VICTORY & PRIDE
                  <g filter="url(#neonGlow)">
                    <polygon
                      points="0,-16 4,-4 16,-3 7,4 10,16 0,9 -10,16 -7,4 -16,-3 -4,-4"
                      fill={emotionTheme.primary}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </g>
                ) : currentEmotion === 'combate' ? (
                  <g filter="url(#neonGlow)">
                    <circle cx="0" cy="0" r="13" fill="none" stroke={emotionTheme.primary} strokeWidth="3" />
                    <circle cx={mousePos.x * 4} cy={mousePos.y * 3} r="6.5" fill={emotionTheme.primary} />
                    <line x1="-16" y1="0" x2="16" y2="0" stroke={emotionTheme.primary} strokeWidth="1.5" />
                    <line x1="0" y1="-16" x2="0" y2="16" stroke={emotionTheme.primary} strokeWidth="1.5" />
                  </g>
                ) : currentEmotion === 'melancolia' ? (
                  <g filter="url(#neonGlow)">
                    <line x1="-11" y1="-11" x2="11" y2="11" stroke={emotionTheme.primary} strokeWidth="4" strokeLinecap="round" />
                    <line x1="11" y1="-11" x2="-11" y2="11" stroke={emotionTheme.primary} strokeWidth="4" strokeLinecap="round" />
                  </g>
                ) : currentEmotion === 'alivio' ? (
                  <path
                    d="M -15 3 Q 0 -11 15 3"
                    fill="none"
                    stroke={emotionTheme.primary}
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#neonGlow)"
                  />
                ) : (
                  <g filter="url(#neonGlow)">
                    <circle cx="0" cy="0" r="14" fill="none" stroke={emotionTheme.primary} strokeWidth="2" strokeDasharray="3 2" />
                    <circle cx={mousePos.x * 5} cy={mousePos.y * 4} r="7.5" fill={emotionTheme.primary} />
                    <circle cx={mousePos.x * 5 - 2} cy={mousePos.y * 4 - 2} r="2" fill="#ffffff" />
                  </g>
                )}
              </g>

              {/* --------------------------------------------------------- */}
              {/* REAL-TIME MECHANICAL TITANIUM BEAK LIP-SYNC OVERLAY       */}
              {/* Centered at ~ x: 295, y: 254                               */}
              {/* --------------------------------------------------------- */}
              <g transform="translate(295, 254)">
                {/* Acoustic Voice Visualizer Line inside Beak cleft */}
                {beakOpening > 1 && (
                  <g filter="url(#neonGlow)">
                    {/* Glowing acoustic phoneme wave when speaking */}
                    <ellipse
                      cx="0"
                      cy={beakOpening * 0.4}
                      rx="14"
                      ry={beakOpening * 0.45}
                      fill="rgba(5, 12, 24, 0.95)"
                      stroke={emotionTheme.primary}
                      strokeWidth="2"
                    />
                    {/* Interior audio laser glow */}
                    <line
                      x1="-10"
                      y1={beakOpening * 0.4}
                      x2="10"
                      y2={beakOpening * 0.4}
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </g>
                )}
              </g>

              {/* --------------------------------------------------------- */}
              {/* HEADPHONE GRAPHIC EQUALIZER DIAL (Top-Left Ear Cup)       */}
              {/* Centered at ~ x: 128, y: 202                               */}
              {/* --------------------------------------------------------- */}
              <g transform="translate(126, 192)">
                <g filter="url(#neonGlow)">
                  {eqBarHeights.map((h, i) => (
                    <rect
                      key={i}
                      x={i * 5 - 8}
                      y={-h / 2}
                      width="3.5"
                      height={h}
                      rx="1.5"
                      fill={i === 2 ? '#fbbf24' : emotionTheme.primary}
                    />
                  ))}
                </g>
              </g>
            </svg>
          </div>
        </div>

        {/* End of avatar container */}
      </div>

      {/* Floating Global CSS for subtle breathing */}
      <style>{`
        @keyframes floatBreathing {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-8px) rotate(1deg);
          }
        }
      `}</style>
    </div>
  );
};
